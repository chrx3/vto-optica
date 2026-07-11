/**
 * Wrapper de MediaPipe Face Mesh.
 *
 * Inicializa el modelo y entrega landmarks normalizados (0-1) por frame.
 * 100% client-side, no requiere backend.
 */

import { FaceMesh, type Results } from '@mediapipe/face_mesh';

// Landmarks clave para posicionamiento de lentes:
//   33  = esquina externa ojo derecho (vista del usuario = izquierda en espejo)
//  133  = esquina externa ojo izquierdo (vista del usuario = derecha en espejo)
//  362  = esquina interna ojo derecho
//  263  = esquina interna ojo izquierdo
//  168  = puente de la nariz (referencia vertical)
const KEY_LANDMARKS = {
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_OUTER: 263,
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_INNER: 362,
  NOSE_BRIDGE: 168,
} as const;

export interface NormalizedLandmark {
  x: number; // 0-1 (normalizado al ancho del frame)
  y: number; // 0-1
  z: number; // profundidad relativa
}

export interface FaceLandmarksResult {
  // Landmarks normalizados relevantes para lentes
  leftEyeOuter: NormalizedLandmark;
  rightEyeOuter: NormalizedLandmark;
  leftEyeInner: NormalizedLandmark;
  rightEyeInner: NormalizedLandmark;
  noseBridge: NormalizedLandmark;
  // Todos los landmarks por si los necesitamos
  all: NormalizedLandmark[];
}

export type FaceMeshCallback = (result: FaceLandmarksResult | null) => void;

export class FaceTracker {
  private faceMesh: FaceMesh | null = null;
  private callback: FaceMeshCallback;
  private debug: boolean;

  constructor(callback: FaceMeshCallback, debug = false) {
    this.callback = callback;
    this.debug = debug;
  }

  async initialize(): Promise<void> {
    if (this.faceMesh) return;

    this.faceMesh = new FaceMesh({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
    });

    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      // Bajamos el threshold: iOS Safari y condiciones de luz imperfectas
      // suelen fallar con 0.5. 0.3 es el sweet spot para tracking robusto.
      minDetectionConfidence: 0.3,
      minTrackingConfidence: 0.3,
    });

    this.faceMesh.onResults(this.handleResults);

    if (this.debug) {
      console.log('[FaceTracker] Inicializado, options aplicadas');
    }
  }

  private handleResults = (results: Results) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      if (this.debug) {
        console.log('[FaceTracker] No face detected');
      }
      this.callback(null);
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];

    if (this.debug && Math.random() < 0.05) {
      // Loggear ~5% de los frames para no saturar la consola
      console.log('[FaceTracker] Face detected, first 5 landmarks:', landmarks.slice(0, 5));
    }

    const pick = (idx: number): NormalizedLandmark => ({
      x: landmarks[idx].x,
      y: landmarks[idx].y,
      z: landmarks[idx].z,
    });

    this.callback({
      leftEyeOuter: pick(KEY_LANDMARKS.LEFT_EYE_OUTER),
      rightEyeOuter: pick(KEY_LANDMARKS.RIGHT_EYE_OUTER),
      leftEyeInner: pick(KEY_LANDMARKS.LEFT_EYE_INNER),
      rightEyeInner: pick(KEY_LANDMARKS.RIGHT_EYE_INNER),
      noseBridge: pick(KEY_LANDMARKS.NOSE_BRIDGE),
      all: landmarks.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z })),
    });
  };

  /**
   * Procesa un frame de video.
   *
   * CRÍTICO: videoWidth y videoHeight deben ser > 0. Si el video es mirror
   * via CSS scaleX(-1), MediaPipe ve el frame SIN espejo (que es lo que
   * queremos para que los landmarks correspondan a la realidad del usuario).
   */
  async processFrame(video: HTMLVideoElement): Promise<void> {
    if (!this.faceMesh) {
      throw new Error('FaceTracker no inicializado. Llama initialize() primero.');
    }

    // Validaciones que evitan el "buscando cara" infinito
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      if (this.debug) {
        console.warn('[FaceTracker] Video sin dimensiones:', video.videoWidth, video.videoHeight);
      }
      return;
    }

    if (video.readyState < 2) {
      if (this.debug) {
        console.warn('[FaceTracker] Video no listo, readyState:', video.readyState);
      }
      return;
    }

    try {
      await this.faceMesh.send({ image: video });
    } catch (err) {
      if (this.debug) {
        console.error('[FaceTracker] Error procesando frame:', err);
      }
    }
  }

  dispose(): void {
    this.faceMesh?.close();
    this.faceMesh = null;
  }
}