/**
 * Calcula la transformación (posición, escala, rotación) del lente
 * a partir de los landmarks faciales detectados.
 *
 * Salida: coordenadas en píxeles del canvas (asumiendo que el canvas
 * tiene las mismas dimensiones que el video renderizado).
 */

import type { FaceLandmarksResult } from './faceTracking';

export interface LensTransform {
  translateX: number; // px - centro X del lente en el canvas
  translateY: number; // px - centro Y del lente en el canvas
  width: number; // px - ancho del lente a renderizar
  rotation: number; // grados
}

export interface LensTransformInput {
  landmarks: FaceLandmarksResult;
  canvasWidth: number;
  canvasHeight: number;
  /** Ancho natural del PNG del lente en píxeles */
  lensImageWidth: number;
  /**
   * Factor de escala: qué tan ancho debe ser el lente relativo a la distancia
   * entre los ojos. ~2.5-3.0 funciona bien para lentes típicos.
   */
  scaleFactor?: number;
}

/**
 * MediaPipe entrega landmarks con X normalizado al ancho de la imagen
 * (no necesariamente al aspect-ratio del video).
 *
 * Para nuestro caso el canvas matchea las dimensiones del video renderizado,
 * por lo que la conversión es: pixel = normalized * canvasDimension.
 *
 * NOTA: si el video se renderiza mirrored (CSS scaleX(-1)), el cálculo de
 * rotación se mantiene igual pero hay que ajustar el translateX si el canvas
 * no está mirrored. En esta implementación asumimos canvas mirrored para
 * coincidir con el video.
 */
export function computeLensTransform(input: LensTransformInput): LensTransform {
  const {
    landmarks,
    canvasWidth,
    canvasHeight,
    lensImageWidth,
    scaleFactor = 2.8,
  } = input;

  const { leftEyeOuter, rightEyeOuter } = landmarks;

  // Convertir landmarks normalizados a píxeles del canvas
  const leftPx = leftEyeOuter.x * canvasWidth;
  const leftPy = leftEyeOuter.y * canvasHeight;
  const rightPx = rightEyeOuter.x * canvasWidth;
  const rightPy = rightEyeOuter.y * canvasHeight;

  // Centro entre los ojos
  const centerX = (leftPx + rightPx) / 2;
  const centerY = (leftPy + rightPy) / 2;

  // Distancia inter-pupilar (IPD) en píxeles
  const dx = rightPx - leftPx;
  const dy = rightPy - leftPy;
  const ipd = Math.sqrt(dx * dx + dy * dy);

  // Ancho objetivo del lente
  const targetWidth = ipd * scaleFactor;

  // Escala relativa al ancho natural del PNG
  const scale = targetWidth / lensImageWidth;
  const renderedHeight = scale * lensImageWidth; // aproximación; idealmente usar aspect real

  // Rotación: ángulo del vector ojo-izq → ojo-der (en grados)
  const rotation = Math.atan2(dy, dx) * (180 / Math.PI);

  // Ajuste vertical: el PNG está centrado, pero queremos que el "puente"
  // del lente quede ligeramente más arriba del centro entre ojos.
  // Empíricamente ~10% de la altura del lente hacia arriba.
  const verticalOffset = renderedHeight * 0.08;

  return {
    translateX: centerX,
    translateY: centerY - verticalOffset,
    width: targetWidth,
    rotation,
  };
}

/**
 * Helper para crear una transformación identidad (cuando no hay cara detectada).
 */
export function emptyTransform(): LensTransform {
  return {
    translateX: 0,
    translateY: 0,
    width: 0,
    rotation: 0,
  };
}