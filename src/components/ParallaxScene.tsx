import { useRef, useEffect, useCallback } from 'react';
import { useParallax } from '@/lib/parallax-context';

declare const FaceDetection: any;
declare const Camera: any;

export default function ParallaxScene({ children }: { children: React.ReactNode }) {
  const {
    enabled, trackingMode,
    updateTarget, setFaceDetected, setCameraActive, setStatusText,
    lerpRef, targetRef,
  } = useParallax();

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceDotRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const mpCameraRef = useRef<any>(null);
  const faceDetectionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptsLoadedRef = useRef(false);

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
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

          if (faceDotRef.current && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            faceDotRef.current.style.left = (cx * rect.width) + 'px';
            faceDotRef.current.style.top = (cy * rect.height) + 'px';
            faceDotRef.current.style.display = 'block';
          }
          setStatusText(`Head Tracking ✓ | x: ${tx.toFixed(2)} y: ${ty.toFixed(2)}`);
        } else {
          setFaceDetected(false);
          if (faceDotRef.current) faceDotRef.current.style.display = 'none';
          setStatusText('Head Tracking — no face detected');
        }
      });

      const mpCam = new Camera(videoRef.current, {
        onFrame: async () => {
          if (faceDetectionRef.current) {
            await faceDetectionRef.current.send({ image: videoRef.current });
          }
        },
        width: 320,
        height: 240,
      });
      mpCameraRef.current = mpCam;
      await mpCam.start();

      setStatusText('Head Tracking ✓ | looking for face…');
    } catch (err: any) {
      setStatusText(`Camera error: ${String(err).slice(0, 50)}`);
      stopHeadTracking();
    }
  }, [loadMediaPipeScripts, updateTarget, setFaceDetected, setCameraActive, setStatusText, stopHeadTracking]);

  useEffect(() => {
    if (!enabled) {
      stopHeadTracking();
      return;
    }
    if (trackingMode === 'head') {
      startHeadTracking();
    } else {
      stopHeadTracking();
      setStatusText('Mode: Mouse');
    }
    return () => { stopHeadTracking(); };
  }, [enabled, trackingMode]);

  useEffect(() => {
    if (!enabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (trackingMode !== 'mouse') return;
      const tx = (e.clientX / window.innerWidth) * 2 - 1;
      const ty = (e.clientY / window.innerHeight) * 2 - 1;
      updateTarget(tx, ty);
      setStatusText(`Mode: Mouse | x: ${tx.toFixed(2)} y: ${ty.toFixed(2)}`);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enabled, trackingMode, updateTarget, setStatusText]);

  useEffect(() => {
    if (!enabled) {
      cancelAnimationFrame(animFrameRef.current);
      if (contentRef.current) {
        contentRef.current.style.transform = '';
      }
      return;
    }

    const animate = () => {
      const lerp = lerpRef.current;
      const target = targetRef.current;
      lerp.headX = lerp.headX * 0.85 + target.x * 0.15;
      lerp.headY = lerp.headY * 0.85 + target.y * 0.15;

      if (contentRef.current) {
        const rotY = -lerp.headX * 2.5;
        const rotX = lerp.headY * 1.8;
        const tX = -lerp.headX * 12;
        const tY = -lerp.headY * 8;
        contentRef.current.style.transform =
          `perspective(1200px) rotateY(${rotY}deg) rotateX(${rotX}deg) translate(${tX}px, ${tY}px)`;
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [enabled, lerpRef, targetRef]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
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
          transition: 'none',
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
