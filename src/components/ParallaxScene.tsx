import { useRef, useEffect, useCallback, useState } from 'react';
import { useParallax } from '@/lib/parallax-context';
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

declare const FaceDetection: any;
declare const Camera: any;

const CUBE_SIZE = 800;

interface PanelConfig {
  id: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  width: number;
  height: number;
}

const PANEL_CONFIGS: PanelConfig[] = [
  {
    id: 'back-wall',
    position: new THREE.Vector3(0, 0, -CUBE_SIZE / 2),
    rotation: new THREE.Euler(0, 0, 0),
    width: CUBE_SIZE,
    height: CUBE_SIZE,
  },
  {
    id: 'left-wall',
    position: new THREE.Vector3(-CUBE_SIZE / 2, 0, 0),
    rotation: new THREE.Euler(0, Math.PI / 2, 0),
    width: CUBE_SIZE,
    height: CUBE_SIZE,
  },
  {
    id: 'right-wall',
    position: new THREE.Vector3(CUBE_SIZE / 2, 0, 0),
    rotation: new THREE.Euler(0, -Math.PI / 2, 0),
    width: CUBE_SIZE,
    height: CUBE_SIZE,
  },
  {
    id: 'top-wall',
    position: new THREE.Vector3(0, CUBE_SIZE / 2, 0),
    rotation: new THREE.Euler(Math.PI / 2, 0, 0),
    width: CUBE_SIZE,
    height: CUBE_SIZE,
  },
  {
    id: 'bottom-wall',
    position: new THREE.Vector3(0, -CUBE_SIZE / 2, 0),
    rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
    width: CUBE_SIZE,
    height: CUBE_SIZE,
  },
];

const WALL_COLORS: Record<string, string> = {
  'back-wall': 'rgba(160, 32, 240, 0.15)',
  'left-wall': 'rgba(0, 255, 255, 0.1)',
  'right-wall': 'rgba(255, 191, 0, 0.1)',
  'top-wall': 'rgba(0, 128, 128, 0.08)',
  'bottom-wall': 'rgba(148, 0, 211, 0.08)',
};

function createWallElement(config: PanelConfig): HTMLDivElement {
  const el = document.createElement('div');
  el.style.width = config.width + 'px';
  el.style.height = config.height + 'px';
  el.style.background = WALL_COLORS[config.id] || 'rgba(100,100,100,0.1)';
  el.style.border = '1px solid rgba(255,255,255,0.08)';
  el.style.boxSizing = 'border-box';
  el.style.pointerEvents = 'none';
  return el;
}

export default function ParallaxScene({ children }: { children: React.ReactNode }) {
  const {
    enabled, trackingMode,
    updateTarget, setFaceDetected, setCameraActive, setStatusText,
    lerpRef, targetRef,
  } = useParallax();

  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceDotRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const mpCameraRef = useRef<any>(null);
  const faceDetectionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptsLoadedRef = useRef(false);
  const rendererRef = useRef<CSS3DRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const contentObjectRef = useRef<CSS3DObject | null>(null);
  const fpsRef = useRef({ frames: 0, lastTime: performance.now(), fps: 0 });

  const [cubeReady, setCubeReady] = useState(false);

  const initScene = useCallback(() => {
    if (!sceneContainerRef.current) return;

    const container = sceneContainerRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 2000);
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new CSS3DRenderer();
    renderer.setSize(w, h);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    PANEL_CONFIGS.forEach(config => {
      const wallEl = createWallElement(config);
      const obj = new CSS3DObject(wallEl);
      obj.position.copy(config.position);
      obj.rotation.copy(config.rotation);
      scene.add(obj);
    });

    const edgeGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
    const edges = new THREE.EdgesGeometry(edgeGeo);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const wireframe = new THREE.LineSegments(edges, edgeMat);

    const wireframeEl = document.createElement('div');
    wireframeEl.style.width = '1px';
    wireframeEl.style.height = '1px';
    wireframeEl.style.pointerEvents = 'none';

    setCubeReady(true);

    return () => {
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  const destroyScene = useCallback(() => {
    if (rendererRef.current?.domElement?.parentNode) {
      rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
    }
    rendererRef.current = null;
    sceneRef.current = null;
    cameraRef.current = null;
    contentObjectRef.current = null;
    setCubeReady(false);
  }, []);

  const loadMediaPipeScripts = useCallback((): Promise<void> => {
    if (scriptsLoadedRef.current) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let loaded = 0;
      const total = 2;
      const onLoad = () => { loaded++; if (loaded === total) { scriptsLoadedRef.current = true; resolve(); } };
      const urls = [
        'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/face_detection.js',
        'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js',
      ];
      for (const url of urls) {
        if (document.querySelector(`script[src="${url}"]`)) { onLoad(); continue; }
        const s = document.createElement('script');
        s.src = url;
        s.crossOrigin = 'anonymous';
        s.onload = onLoad;
        s.onerror = () => reject(new Error(`Failed to load ${url}`));
        document.head.appendChild(s);
      }
    });
  }, []);

  const stopHeadTracking = useCallback(() => {
    if (mpCameraRef.current) { try { mpCameraRef.current.stop(); } catch {} mpCameraRef.current = null; }
    if (faceDetectionRef.current) { try { faceDetectionRef.current.close(); } catch {} faceDetectionRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setFaceDetected(false);
  }, [setCameraActive, setFaceDetected]);

  const startHeadTracking = useCallback(async () => {
    try {
      setStatusText('Loading face detection...');
      await loadMediaPipeScripts();

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);

      const fd = new FaceDetection({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/${file}`
      });
      faceDetectionRef.current = fd;

      fd.setOptions({ model: 'short', minDetectionConfidence: 0.5 });

      fd.onResults((results: any) => {
        if (results.detections && results.detections.length > 0) {
          const det = results.detections[0];
          const box = det.boundingBox;
          const cx = 1 - box.xCenter;
          const cy = box.yCenter;
          const tx = cx * 2 - 1;
          const ty = cy * 2 - 1;
          updateTarget(tx, ty);
          setFaceDetected(true);
          if (faceDotRef.current && sceneContainerRef.current) {
            const rect = sceneContainerRef.current.getBoundingClientRect();
            faceDotRef.current.style.left = (cx * rect.width) + 'px';
            faceDotRef.current.style.top = (cy * rect.height) + 'px';
            faceDotRef.current.style.display = 'block';
          }
          setStatusText(`Head ✓ | x:${tx.toFixed(2)} y:${ty.toFixed(2)} | faces:1`);
        } else {
          setFaceDetected(false);
          if (faceDotRef.current) faceDotRef.current.style.display = 'none';
          setStatusText('Head — no face');
        }
      });

      const mpCam = new Camera(videoRef.current, {
        onFrame: async () => {
          if (faceDetectionRef.current) {
            await faceDetectionRef.current.send({ image: videoRef.current });
          }
        },
        width: 320, height: 240,
      });
      mpCameraRef.current = mpCam;
      await mpCam.start();
      setStatusText('Head ✓ | looking for face…');
    } catch (err: any) {
      setStatusText(`Cam error: ${String(err).slice(0, 40)}`);
      stopHeadTracking();
    }
  }, [loadMediaPipeScripts, updateTarget, setFaceDetected, setCameraActive, setStatusText, stopHeadTracking]);

  useEffect(() => {
    if (!enabled) { stopHeadTracking(); return; }
    if (trackingMode === 'head') { startHeadTracking(); }
    else { stopHeadTracking(); setStatusText('Mode: Mouse'); }
    return () => { stopHeadTracking(); };
  }, [enabled, trackingMode]);

  useEffect(() => {
    if (!enabled) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (trackingMode !== 'mouse') return;
      const tx = (e.clientX / window.innerWidth) * 2 - 1;
      const ty = (e.clientY / window.innerHeight) * 2 - 1;
      updateTarget(tx, ty);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enabled, trackingMode, updateTarget]);

  useEffect(() => {
    if (!enabled) {
      cancelAnimationFrame(animFrameRef.current);
      destroyScene();
      if (contentRef.current) contentRef.current.style.transform = '';
      return;
    }

    const cleanup = initScene();

    const animate = () => {
      const lerp = lerpRef.current;
      const target = targetRef.current;
      lerp.headX = lerp.headX * 0.85 + target.x * 0.15;
      lerp.headY = lerp.headY * 0.85 + target.y * 0.15;

      const fps = fpsRef.current;
      fps.frames++;
      const now = performance.now();
      if (now - fps.lastTime >= 1000) {
        fps.fps = Math.round(fps.frames * 1000 / (now - fps.lastTime));
        fps.frames = 0;
        fps.lastTime = now;
      }

      if (cameraRef.current && rendererRef.current && sceneRef.current) {
        const cam = cameraRef.current;
        cam.position.x = -lerp.headX * 80;
        cam.position.y = -lerp.headY * 60;
        cam.lookAt(
          -lerp.headX * CUBE_SIZE * 0.4,
          -lerp.headY * CUBE_SIZE * 0.3,
          -CUBE_SIZE / 2
        );
        rendererRef.current.render(sceneRef.current, cam);
      }

      if (contentRef.current) {
        const rotY = -lerp.headX * 3;
        const rotX = lerp.headY * 2;
        const tX = -lerp.headX * 15;
        const tY = -lerp.headY * 10;
        const scale = 1 + Math.abs(lerp.headX * 0.01) + Math.abs(lerp.headY * 0.008);
        contentRef.current.style.transform =
          `perspective(1400px) rotateY(${rotY}deg) rotateX(${rotX}deg) translate(${tX}px, ${tY}px) scale(${scale})`;
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (cleanup) cleanup();
    };
  }, [enabled, lerpRef, targetRef, initScene, destroyScene]);

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
  }, [enabled, cubeReady]);

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
        ref={contentRef}
        style={{
          width: '100%',
          height: '100%',
          transformOrigin: 'center center',
          willChange: 'transform',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {children}
      </div>

      <div
        data-testid="parallax-status-overlay"
        style={{
          position: 'fixed',
          top: 50,
          left: 20,
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.6)',
          color: '#0ff',
          borderRadius: 6,
          fontSize: 11,
          lineHeight: 1.6,
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(0,255,255,0.2)',
          fontFamily: 'monospace',
          zIndex: 10000,
          pointerEvents: 'none',
          whiteSpace: 'pre',
        }}
      >
        {`Mode: ${trackingMode === 'head' ? 'Head Tracking' : 'Mouse'}\nx: ${lerpRef.current.headX.toFixed(2)}  y: ${lerpRef.current.headY.toFixed(2)}\nFPS: ${fpsRef.current.fps}`}
      </div>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        data-testid="parallax-cam-preview"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 160,
          height: 120,
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.2)',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
          display: trackingMode === 'head' && enabled ? 'block' : 'none',
          zIndex: 9999,
          boxShadow: '0 4px 20px rgba(160,32,240,0.3)',
        }}
      />

      <div
        ref={faceDotRef}
        data-testid="parallax-face-dot"
        style={{
          position: 'fixed',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#0ff',
          pointerEvents: 'none',
          zIndex: 10000,
          transform: 'translate(-50%, -50%)',
          display: 'none',
          boxShadow: '0 0 8px #0ff',
        }}
      />
    </div>
  );
}
