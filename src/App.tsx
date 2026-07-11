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

interface DebugLog {
  ts: number;
  msg: string;
}

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
  const [debugLog, setDebugLog] = useState<DebugLog[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);
  const rafRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);
  const frameCountRef = useRef(0);
  const detectionCountRef = useRef(0);

  const pushLog = useCallback(
    (msg: string) => {
      if (!DEBUG) return;
      console.log(msg);
      setDebugLog((prev) => {
        const next = [...prev, { ts: Date.now(), msg }];
        // Mantener solo últimas 8 entradas
        return next.slice(-8);
      });
    },
    []
  );

  useEffect(() => {
    pushLog('[App] Mounted');
  }, [pushLog]);

  // Precargar imagen del lente seleccionado
  useEffect(() => {
    pushLog(`[App] Loading lens: ${selectedLens.id}`);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setLensImage(img);
      pushLog(`[App] Lens loaded: ${selectedLens.id} (${img.naturalWidth}x${img.naturalHeight})`);
    };
    img.onerror = () => {
      console.error('[App] No se pudo cargar:', selectedLens.imagePath);
      pushLog(`[App] Lens FAILED: ${selectedLens.imagePath}`);
      setLensImage(null);
    };
    img.src = selectedLens.imagePath;
  }, [selectedLens, pushLog]);

  // Inicializar FaceTracker una vez que el video esté listo
  const handleVideoReady = useCallback((video: HTMLVideoElement) => {
    pushLog('[App] handleVideoReady called');
    videoRef.current = video;

    const updateRenderSize = () => {
      const rect = video.getBoundingClientRect();
      setRenderSize({ width: rect.width, height: rect.height });
      pushLog(`[App] render size: ${rect.width}x${rect.height}, video: ${video.videoWidth}x${video.videoHeight}`);
    };

    updateRenderSize();

    const onMeta = () => {
      pushLog(`[App] loadedmetadata: video ${video.videoWidth}x${video.videoHeight}`);
      updateRenderSize();
    };
    video.addEventListener('loadedmetadata', onMeta);

    const tracker = new FaceTracker((result) => {
      if (result) {
        detectionCountRef.current += 1;
      }
      setLandmarks(result);
    }, DEBUG);

    trackerRef.current = tracker;
    pushLog('[App] Initializing FaceTracker...');

    tracker.initialize().then(() => {
      pushLog('[App] FaceTracker initialized, starting RAF loop');

      const processLoop = async () => {
        const v = videoRef.current;
        if (!v || !trackerRef.current) {
          pushLog('[App] RAF loop exit (video or tracker missing)');
          return;
        }

        frameCountRef.current += 1;
        if (frameCountRef.current % 30 === 0) {
          setFrameCount(frameCountRef.current);
          setDetectionCount(detectionCountRef.current);
        }

        if (!isProcessingRef.current) {
          isProcessingRef.current = true;
          try {
            await trackerRef.current.processFrame(v);
          } catch (e) {
            pushLog(`[App] processFrame threw: ${e}`);
          } finally {
            isProcessingRef.current = false;
          }
        }

        rafRef.current = requestAnimationFrame(processLoop);
      };

      rafRef.current = requestAnimationFrame(processLoop);
    }).catch((e) => {
      pushLog(`[App] tracker.initialize() failed: ${e}`);
    });
  }, [pushLog]);

  const handleError = useCallback(
    (msg: string) => {
      pushLog(`[App] camera error: ${msg}`);
      setError(msg);
    },
    [pushLog]
  );

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      pushLog('[App] Unmounting');
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      trackerRef.current?.dispose();
    };
  }, [pushLog]);

  // Calcular transformación del lente
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
      <CameraView onVideoReady={handleVideoReady} onError={handleError} />

      <GlassesOverlay
        video={video}
        image={lensImage}
        transform={transform}
        width={renderSize.width}
        height={renderSize.height}
      />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
        <h1 className="text-white/90 text-sm font-medium tracking-wide">
          Probador Virtual
        </h1>
        <p className="text-white/50 text-xs">
          {landmarks ? 'Cara detectada ✓' : 'Buscando cara...'}
        </p>
        {DEBUG && (
          <div className="text-white/30 text-[10px] font-mono mt-1 space-y-0.5">
            <div>frames: {frameCount} | det: {detectionCount} | rate: {detectionRate.toFixed(1)}%</div>
            {video && <div>video: {video.videoWidth}x{video.videoHeight} | ready: {video.readyState}</div>}
            <div className="mt-1 max-h-32 overflow-y-auto">
              {debugLog.slice(-5).map((log, i) => (
                <div key={i} className="opacity-70">{log.msg}</div>
              ))}
            </div>
          </div>
        )}
      </div>

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