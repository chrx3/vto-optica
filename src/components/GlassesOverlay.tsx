import { useEffect, useRef } from 'react';
import type { LensTransform } from '../lib/lensTransform';

interface GlassesOverlayProps {
  video: HTMLVideoElement | null;
  image: HTMLImageElement | null;
  transform: LensTransform | null;
  width: number;
  height: number;
}

/**
 * Canvas overlay que dibuja el video (mirrored) + el lente encima.
 *
 * Por qué esto en vez de mostrar el `<video>` directamente:
 * - MediaPipe necesita el video sin espejo (coordenadas reales de la cara)
 * - El usuario espera verse como en un espejo (mirror horizontal)
 * - Si espejamos el `<video>` via CSS, MediaPipe sigue viendo el frame sin espejo,
 *   pero entonces el lente se dibuja sin espejo y queda "girado" respecto al video.
 * - Solución: NO mostramos el `<video>`, dibujamos su frame en el canvas mirrored.
 *   MediaPipe lee del `<video>` no-mirrored. El usuario ve canvas mirrored.
 *   Todo consistente.
 */
export function GlassesOverlay({ video, image, transform, width, height }: GlassesOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.save();
      // Limpiar
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      // Aplicar mirror horizontal al canvas completo
      ctx.translate(width, 0);
      ctx.scale(-1, 1);

      // Dibujar frame de video (si está listo)
      if (video && video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
        // object-fit: cover mantiene aspect ratio cubriendo el canvas
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = width / height;

        let drawW = width;
        let drawH = height;
        let offsetX = 0;
        let offsetY = 0;

        if (videoAspect > canvasAspect) {
          // Video más ancho que canvas → crop horizontal
          drawW = height * videoAspect;
          offsetX = (width - drawW) / 2;
        } else {
          // Video más alto que canvas → crop vertical
          drawH = width / videoAspect;
          offsetY = (height - drawH) / 2;
        }

        try {
          ctx.drawImage(video, offsetX, offsetY, drawW, drawH);
        } catch {
          // drawImage puede tirar si el video no está listo todavía
        }
      }

      // Dibujar lente encima (ya está en sistema mirrored, así que se ve bien)
      if (image && transform && transform.width > 0) {
        const aspectRatio = image.naturalHeight / image.naturalWidth;
        const lensHeight = transform.width * aspectRatio;

        ctx.save();
        ctx.translate(transform.translateX, transform.translateY);
        ctx.rotate((transform.rotation * Math.PI) / 180);

        ctx.drawImage(
          image,
          -transform.width / 2,
          -lensHeight / 2,
          transform.width,
          lensHeight
        );

        ctx.restore();
      }

      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [video, image, transform, width, height]);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />;
}