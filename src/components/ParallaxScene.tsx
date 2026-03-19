import { useRef, useEffect, useCallback, useState } from 'react';
import { useParallax } from '@/lib/parallax-context';
import type { CubeWall } from '@/lib/parallax-types';
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

const DEPTH = 400;
const SIDE_ANGLE = Math.PI / 9;

function buildWallSpecs(vw: number, vh: number, rightPanelCount: number = 1) {
  const halfD = DEPTH / 2;
  const topH = Math.max(120, Math.round(vh * 0.15));

  const leftW = Math.max(240, Math.round(vw * 0.2));
  const singleRightW = Math.max(300, Math.round(vw * 0.25));
  const rightW = singleRightW * Math.max(1, rightPanelCount);
  const halfW = vw / 2;

  const leftCX = leftW / 2 * Math.cos(SIDE_ANGLE);
  const leftCZ = leftW / 2 * Math.sin(SIDE_ANGLE);
  const rightCX = rightW / 2 * Math.cos(SIDE_ANGLE);
  const rightCZ = rightW / 2 * Math.sin(SIDE_ANGLE);

  const bottomAngle = -(Math.PI / 9);
  const bottomCY = vh / 2 * Math.cos(bottomAngle);
  const bottomCZ = vh / 2 * Math.sin(bottomAngle);

  return [
    { wall: 'back' as CubeWall,   position: [0, 0, -halfD] as [number,number,number],  rotation: [0, 0, 0] as [number,number,number], width: vw, height: vh },
    { wall: 'left' as CubeWall,   position: [-(halfW + leftCX), 0, -halfD + leftCZ] as [number,number,number],  rotation: [0, SIDE_ANGLE, 0] as [number,number,number], width: leftW, height: vh },
    { wall: 'right' as CubeWall,  position: [halfW + rightCX, 0, -halfD + rightCZ] as [number,number,number],   rotation: [0, -SIDE_ANGLE, 0] as [number,number,number], width: rightW, height: vh },
    { wall: 'top' as CubeWall,    position: [0, vh / 2 + topH / 2, -halfD] as [number,number,number], rotation: [0, 0, 0] as [number,number,number], width: vw, height: topH },
    { wall: 'bottom' as CubeWall, position: [0, -(vh / 2 + bottomCY), -halfD - bottomCZ] as [number,number,number], rotation: [bottomAngle, 0, 0] as [number,number,number], width: vw, height: vh },
  ];
}

const WALL_COLORS: Record<CubeWall, { bg: string; border: string }> = {
  back:   { bg: 'rgba(160, 32, 240, 0.06)', border: 'rgba(160, 32, 240, 0.15)' },
  left:   { bg: 'rgba(0, 255, 255, 0.05)',  border: 'rgba(0, 255, 255, 0.12)' },
  right:  { bg: 'rgba(255, 191, 0, 0.05)',  border: 'rgba(255, 191, 0, 0.12)' },
  top:    { bg: 'rgba(0, 128, 128, 0.04)',  border: 'rgba(0, 128, 128, 0.1)' },
  bottom: { bg: 'rgba(148, 0, 211, 0.04)',  border: 'rgba(148, 0, 211, 0.1)' },
};


type FocusTarget = CubeWall | 'center';

const FOCUS_OFFSETS: Record<string, { x: number; y: number; z: number; lookX: number; lookY: number; lookZ: number }> = {
  center: { x: 0, y: 0, z: 0, lookX: 0, lookY: 0, lookZ: -(DEPTH / 2) },
  left:   { x: -375, y: 0, z: -90, lookX: -600, lookY: 0, lookZ: -(DEPTH / 2) + 50 },
  right:  { x: 375, y: 0, z: -90, lookX: 600, lookY: 0, lookZ: -(DEPTH / 2) + 50 },
};

const DBLCLICK_THRESHOLD = 400;

export default function ParallaxScene({ children }: { children: React.ReactNode }) {
  const {
    enabled, trackingMode,
    lerpRef, targetRef, fpsRef,
    registerWallMount,
    videoRef, faceDotRef,
    cameraActive,
    focusedWall, setFocusedWall,
    rightPanelCount,
    rightWallWidthPx,
  } = useParallax();

  const focusedWallRef = useRef(focusedWall);
  focusedWallRef.current = focusedWall;

  const trackingModeRef = useRef(trackingMode);
  trackingModeRef.current = trackingMode;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const rendererRef = useRef<CSS3DRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const wallElsRef = useRef<Record<CubeWall, HTMLDivElement | null>>({
    back: null, left: null, right: null, top: null, bottom: null,
  });
  const registerWallMountRef = useRef(registerWallMount);
  registerWallMountRef.current = registerWallMount;

  const lerpLookRef = useRef({ x: 0, y: 0, z: -(DEPTH / 2) });
  const zoomOffsetRef = useRef(0);
  const [sceneReady, setSceneReady] = useState(false);
  const sceneInitializedRef = useRef(false);
  const lastPointerDownRef = useRef<Record<string, number>>({});

  const initScene = useCallback(() => {
    if (!sceneContainerRef.current || sceneInitializedRef.current) return;
    const container = sceneContainerRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, w / h, 1, 5000);
    camera.position.set(0, 0, DEPTH * 0.65);
    cameraRef.current = camera;

    const renderer = new CSS3DRenderer();
    renderer.setSize(w, h);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    renderer.domElement.style.pointerEvents = 'auto';
    renderer.domElement.style.overflow = 'hidden';
    const viewEl = renderer.domElement.firstElementChild as HTMLElement;
    if (viewEl) {
      viewEl.style.pointerEvents = 'auto';
      viewEl.style.overflow = 'visible';
      const camEl = viewEl.firstElementChild as HTMLElement;
      if (camEl) {
        camEl.style.pointerEvents = 'auto';
        camEl.style.overflow = 'visible';
      }
    }

    const resetScroll = () => {
      renderer.domElement.scrollTop = 0;
      renderer.domElement.scrollLeft = 0;
      if (viewEl) { viewEl.scrollTop = 0; viewEl.scrollLeft = 0; }
      const camEl = viewEl?.firstElementChild as HTMLElement | null;
      if (camEl) { camEl.scrollTop = 0; camEl.scrollLeft = 0; }
    };
    renderer.domElement.addEventListener('scroll', resetScroll, true);
    renderer.domElement.addEventListener('focusin', () => requestAnimationFrame(resetScroll), true);

    const styleEl = document.createElement('style');
    styleEl.textContent = `
      [data-wall-mount] * {
        pointer-events: auto;
      }
    `;
    document.head.appendChild(styleEl);

    const wallSpecs = buildWallSpecs(w, h, rightPanelCount);
    wallSpecs.forEach(spec => {
      const colors = WALL_COLORS[spec.wall];
      const wall = spec.wall as CubeWall;

      const wallEl = document.createElement('div');
      wallEl.style.width = spec.width + 'px';
      wallEl.style.height = spec.height + 'px';
      wallEl.style.background = colors.bg;
      wallEl.style.border = `1px solid ${colors.border}`;
      wallEl.style.boxSizing = 'border-box';
      wallEl.style.overflow = 'hidden';
      wallEl.style.position = 'relative';
      wallEl.setAttribute('data-wall', spec.wall);

      const mountPoint = document.createElement('div');
      mountPoint.style.position = 'absolute';
      mountPoint.style.top = '0';
      mountPoint.style.left = '0';
      mountPoint.style.width = '100%';
      mountPoint.style.height = '100%';
      mountPoint.style.display = 'flex';
      mountPoint.style.alignItems = 'stretch';
      mountPoint.style.pointerEvents = 'auto';
      mountPoint.setAttribute('data-wall-mount', spec.wall);

      if (wall === 'right') {
        mountPoint.style.flexDirection = 'row';
        mountPoint.style.overflowX = 'auto';
        mountPoint.style.overflowY = 'hidden';
      } else if (wall === 'left') {
        mountPoint.style.flexDirection = 'row';
        mountPoint.style.justifyContent = 'flex-end';
        mountPoint.style.overflow = 'auto';
      } else {
        mountPoint.style.flexDirection = 'column';
        mountPoint.style.overflow = 'auto';
      }

      if (wall === 'left' || wall === 'right' || wall === 'back') {
        const dblClickOverlay = document.createElement('div');
        dblClickOverlay.style.position = 'absolute';
        dblClickOverlay.style.top = '0';
        dblClickOverlay.style.left = '0';
        dblClickOverlay.style.width = '100%';
        dblClickOverlay.style.height = '100%';
        dblClickOverlay.style.zIndex = '9999';
        dblClickOverlay.style.pointerEvents = 'none';
        dblClickOverlay.setAttribute('data-dblclick-catcher', wall);

        wallEl.addEventListener('pointerdown', (e) => {
          const now = Date.now();
          const lastTime = lastPointerDownRef.current[wall] || 0;
          lastPointerDownRef.current[wall] = now;
          if (now - lastTime < DBLCLICK_THRESHOLD) {
            e.preventDefault();
            e.stopPropagation();
            if (wall === 'back') {
              setFocusedWall('center');
            } else {
              setFocusedWall(focusedWallRef.current === wall ? 'center' : wall);
            }
            lastPointerDownRef.current[wall] = 0;
          }
        }, true);

        wallEl.appendChild(dblClickOverlay);
      }

      wallEl.appendChild(mountPoint);

      const obj = new CSS3DObject(wallEl);
      obj.position.set(...spec.position);
      obj.rotation.set(...spec.rotation);
      scene.add(obj);
      (wallEl as any).__css3dObject = obj;

      wallElsRef.current[spec.wall] = wallEl;
      registerWallMountRef.current(spec.wall, mountPoint);
    });

    sceneInitializedRef.current = true;
    setSceneReady(true);

    return () => {
      if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      renderer.domElement.removeEventListener('scroll', resetScroll, true);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      const walls: CubeWall[] = ['back', 'left', 'right', 'top', 'bottom'];
      walls.forEach(w => {
        registerWallMountRef.current(w, null);
        wallElsRef.current[w] = null;
      });
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      sceneInitializedRef.current = false;
      setSceneReady(false);
    };
  }, []);

  useEffect(() => {
    const rightEl = wallElsRef.current.right;
    if (!enabled || !rightEl || !sceneContainerRef.current) return;
    const container = sceneContainerRef.current;
    const vw = container.clientWidth;
    const vh = container.clientHeight;
    const specs = buildWallSpecs(vw, vh, rightPanelCount);
    const rightSpec = specs.find(s => s.wall === 'right');
    if (!rightSpec) return;
    const effectiveWidth = rightWallWidthPx > 0 ? rightWallWidthPx : rightSpec.width;
    rightEl.style.width = effectiveWidth + 'px';
    const halfW = vw / 2;
    const rightCX = effectiveWidth / 2 * Math.cos(SIDE_ANGLE);
    const rightCZ = effectiveWidth / 2 * Math.sin(SIDE_ANGLE);
    const obj = (rightEl as any).__css3dObject;
    if (obj) {
      obj.position.set(halfW + rightCX, 0, -200 + rightCZ);
    }
  }, [rightPanelCount, rightWallWidthPx, enabled]);

  useEffect(() => {
    if (!enabled) {
      cancelAnimationFrame(animFrameRef.current);
      if (rendererRef.current?.domElement) {
        rendererRef.current.domElement.style.display = 'none';
      }
      return;
    }

    if (!sceneInitializedRef.current) {
      initScene();
    }
    if (rendererRef.current?.domElement) {
      rendererRef.current.domElement.style.display = '';
    }

    const animate = () => {
      const lerp = lerpRef.current;
      const target = targetRef.current;
      lerp.headX = lerp.headX * 0.85 + target.x * 0.15;
      lerp.headY = lerp.headY * 0.85 + target.y * 0.15;
      lerp.headZ = lerp.headZ * 0.85 + target.z * 0.15;

      const fpsData = fpsRef.current;
      fpsData.frames++;
      const now = performance.now();
      if (now - fpsData.lastTime >= 1000) {
        fpsData.fps = Math.round(fpsData.frames * 1000 / (now - fpsData.lastTime));
        fpsData.frames = 0;
        fpsData.lastTime = now;
      }

      const mode = trackingModeRef.current;
      const invertX = mode === 'head' ? -1 : 1;
      const invertY = mode === 'head' ? 1 : -1;

      if (cameraRef.current && rendererRef.current && sceneRef.current) {
        const cam = cameraRef.current;
        const fo = FOCUS_OFFSETS[focusedWallRef.current] || FOCUS_OFFSETS.center;
        const baseZ = DEPTH * 0.65;
        const smooth = 0.04;
        const targetPosX = invertX * lerp.headX * 400 + fo.x;
        const targetPosY = invertY * lerp.headY * 200 + fo.y;
        const targetPosZ = baseZ + fo.z + zoomOffsetRef.current - lerp.headZ * 150;
        cam.position.x += (targetPosX - cam.position.x) * smooth;
        cam.position.y += (targetPosY - cam.position.y) * smooth;
        cam.position.z += (targetPosZ - cam.position.z) * smooth;
        const targetLookX = invertX * lerp.headX * 600 + fo.lookX;
        const targetLookY = invertY * lerp.headY * 400 + fo.lookY;
        const targetLookZ = fo.lookZ;
        lerpLookRef.current.x += (targetLookX - lerpLookRef.current.x) * smooth;
        lerpLookRef.current.y += (targetLookY - lerpLookRef.current.y) * smooth;
        lerpLookRef.current.z += (targetLookZ - lerpLookRef.current.z) * smooth;
        cam.lookAt(lerpLookRef.current.x, lerpLookRef.current.y, lerpLookRef.current.z);

        rendererRef.current.render(sceneRef.current, cam);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const isInsideScrollable = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      let el: HTMLElement | null = target;
      while (el) {
        if (el.tagName === 'IFRAME' || el.tagName === 'WEBVIEW') return true;
        const ov = getComputedStyle(el).overflowY;
        if ((ov === 'auto' || ov === 'scroll') && el.scrollHeight > el.clientHeight) {
          return true;
        }
        if (el.hasAttribute('data-wall')) break;
        el = el.parentElement;
      }
      return false;
    };

    const handleWheel = (e: WheelEvent) => {
      if (isInsideScrollable(e.target)) return;
      const step = e.deltaY > 0 ? 30 : -30;
      zoomOffsetRef.current = Math.max(-200, Math.min(400, zoomOffsetRef.current + step));
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !rendererRef.current || !cameraRef.current) return;
    const handleResize = () => {
      if (!sceneContainerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = sceneContainerRef.current.clientWidth;
      const h = sceneContainerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [enabled, sceneReady]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div
      ref={sceneContainerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#0a0014',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          zIndex: -1,
          pointerEvents: 'none',
          opacity: 0,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        data-testid="parallax-cam-preview"
        style={{ position: 'fixed', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
      />

      <div
        ref={faceDotRef}
        data-testid="parallax-face-dot"
        style={{ position: 'fixed', width: 0, height: 0, display: 'none' }}
      />
    </div>
  );
}
