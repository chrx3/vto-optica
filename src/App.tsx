import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraView } from './components/CameraView';
import { GlassesOverlay } from './components/GlassesOverlay';
import { LensSelector } from './components/LensSelector';
import { CATALOG, DEFAULT_LENS_ID } from './lib/catalog';
import { FaceTracker, type FaceLandmarksResult } from './lib/faceTracking';
import { computeLensTransform } from './lib/lensTransform';
import type { Lens } from './types/lens';

// Activar debug via ?debug=1 en la URL
const DEBUG = new URLSearchParams(window.location.search).get('debug') === '1';

export default function App() {
  const [selectedLens, setSelectedLens] = useState<Lens>(
    CATALOG.find((l) => l.id === DEFAULT_LENS_ID) ?? CATALOG[0]
  );
  const [lensImage, setLensImage] = useState<HTMLImageElement | null>(null);
  const [landmarks, setLandmarks] = useState<FaceLandmarksResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });
  const [frameCount, setFrameCount] = useState(0);
  const [detectionCount, setDetectionCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);
  const rafRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);
  const frameCountRef = useRef(0);
  const detectionCountRef = useRef(0);

  // Precargar imagen del lente seleccionado
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setLensImage(img);
      if (DEBUG) console.log('[App] Lens image cargada:', selectedLens.name, img.naturalWidth, 'x', img.naturalHeight);
    };
    img.onerror = () => {
      console.error('[App] No se pudo cargar:', selectedLens.imagePath);
      setLensImage(null);
    };
    img.src = selectedLens.imagePath;
  }, [selectedLens]);

  // Inicializar FaceTracker una vez que el video esté listo
  const handleVideoReady = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;

    const updateRenderSize = () => {
      const rect = video.getBoundingClientRect();
      setRenderSize({ width: rect.width, height: rect.height });
      if (DEBUG) console.log('[App] Video size:', rect.width, 'x', rect.height);
    };

    updateRenderSize();
    window.addEventListener('resize', updateRenderSize);
    video.addEventListener('loadedmetadata', updateRenderSize);

    const tracker = new FaceTracker((result) => {
      setLandmarks(result);
      if (result) {
        detectionCountRef.current += 1;
      }
    }, DEBUG);

    trackerRef.current = tracker;

    tracker.initialize().then(() => {
      if (DEBUG) console.log('[App] FaceTracker ready, starting loop');

      // Loop de procesamiento: por cada frame, enviamos a MediaPipe
      const processLoop = async () => {
        const v = videoRef.current;
        if (!v || !trackerRef.current) return;

        frameCountRef.current += 1;
        if (frameCountRef.current % 30 === 0) {
          setFrameCount(frameCountRef.current);
          setDetectionCount(detectionCountRef.current);
        }

        if (!isProcessingRef.current) {
          isProcessingRef.current = true;
          try {
            await trackerRef.current.processFrame(v);
          } finally {
            isProcessingRef.current = false;
          }
        }

        rafRef.current = requestAnimationFrame(processLoop);
      };

      rafRef.current = requestAnimationFrame(processLoop);
    });

    return () => {
      window.removeEventListener('resize', updateRenderSize);
      video.removeEventListener('loadedmetadata', updateRenderSize);
    };
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      trackerRef.current?.dispose();
    };
  }, []);

  // Calcular transformación del lente
  // CRÍTICO: usamos videoWidth/Height REALES del stream (no del DOM),
  // porque MediaPipe normaliza landmarks al aspect ratio del video real.
  const video = videoRef.current;
  const transform =
    landmarks && renderSize.width > 0 && lensImage && video && video.videoWidth > 0
      ? computeLensTransform({
          landmarks,
          canvasWidth: video.videoWidth,
          canvasHeight: video.videoHeight,
          lensImageWidth: lensImage.naturalWidth,
          scaleFactor: 2.6,
        })
      : null;

  const detectionRate = frameCount > 0 ? (detectionCount / frameCount) * 100 : 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <CameraView onVideoReady={handleVideoReady} onError={setError} />

      <GlassesOverlay
        video={video}
        image={lensImage}
        transform={transform}
        width={renderSize.width}
        height={renderSize.height}
      />

      {/* Header minimalista */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
        <h1 className="text-white/90 text-sm font-medium tracking-wide">
          Probador Virtual
        </h1>
        <p className="text-white/50 text-xs">
          {landmarks ? 'Cara detectada ✓' : 'Buscando cara...'}
        </p>
        {DEBUG && (
          <p className="text-white/30 text-[10px] font-mono mt-1">
            frames: {frameCount} | detections: {detectionCount} | rate: {detectionRate.toFixed(1)}%
            {video && ` | video: ${video.videoWidth}x${video.videoHeight}`}
          </p>
        )}
      </div>

      {/* Error toast */}
      {error && (
        <div className="absolute top-16 left-4 right-4 z-20 bg-red-500/90 text-white text-xs px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <LensSelector
        catalog={CATALOG}
        selectedId={selectedLens.id}
        onSelect={setSelectedLens}
      />
    </div>
  );
}