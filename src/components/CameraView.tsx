import { useEffect, useRef, useState } from 'react';

interface CameraViewProps {
  onVideoReady: (video: HTMLVideoElement) => void;
  onError: (error: string) => void;
}

/**
 * Componente que solicita permiso de cámara y muestra el video en vivo.
 *
 * - playsInline es CRÍTICO para iOS Safari (sin esto, abre en fullscreen)
 * - Usamos la cámara frontal por defecto (facingMode: 'user')
 * - El video NO se renderiza mirrored acá. El espejo se aplica SOLO en
 *   el canvas overlay (GlassesOverlay), porque MediaPipe necesita ver
 *   la cara en su orientación real para detectar landmarks correctamente.
 *   El usuario ve el resultado final (video + lente) como espejo, que es
 *   lo intuitivo (como verse en un espejo real).
 */
export function CameraView({ onVideoReady, onError }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'requesting' | 'ready' | 'denied'>(
    'requesting'
  );

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function initCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();

        setStatus('ready');
        onVideoReady(video);
      } catch (err) {
        console.error('[CameraView] Error:', err);
        setStatus('denied');
        onError(
          err instanceof Error
            ? err.message
            : 'No se pudo acceder a la cámara. Verifica los permisos.'
        );
      }
    }

    initCamera();

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onVideoReady, onError]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0 }}
      />
      {status === 'requesting' && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
          Solicitando acceso a cámara...
        </div>
      )}
      {status === 'denied' && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm text-center px-4">
          <div>
            <p className="mb-2">Cámara no disponible</p>
            <p className="text-xs text-white/50">
              Verifica los permisos del navegador y vuelve a intentar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}