import { useEffect, useRef } from 'react';
import type { LensTransform } from '../lib/lensTransform';

interface GlassesOverlayProps {
  image: HTMLImageElement | null;
  transform: LensTransform | null;
  width: number;
  height: number;
}

/**
 * Canvas overlay que dibuja el PNG del lente con la transformación calculada.
 *
 * - El canvas se redimensiona al tamaño del video renderizado
 * - Se redibuja cada vez que cambia la transformación o la imagen
 * - Usa devicePixelRatio para verse nítido en pantallas Retina
 */
export function GlassesOverlay({ image, transform, width, height }: GlassesOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    ctx.clearRect(0, 0, width, height);

    // Mirror igual que el video (scaleX(-1)) para que el lente no quede invertido
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);

    if (image && transform && transform.width > 0) {
      // Calcular alto del lente manteniendo aspect ratio
      const aspectRatio = image.naturalHeight / image.naturalWidth;
      const lensHeight = transform.width * aspectRatio;

      ctx.save();
      ctx.translate(transform.translateX, transform.translateY);
      ctx.rotate((transform.rotation * Math.PI) / 180);

      // Dibujar centrado (translateX/Y es el centro)
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
  }, [image, transform, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ transform: 'scaleX(-1)' }}
    />
  );
}