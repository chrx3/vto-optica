/**
 * Wrapper de MediaPipe Face Mesh.
 *
 * NOTA: MediaPipe está pensado para cargarse como <script> global (UMD),
 * no como módulo ES6. Por eso el index.html carga face_mesh.js y
 * camera_utils.js directamente, y acá accedemos via window.FaceMesh.
 *
 * Bundling con Rollup/Vite rompe los internal module references de MediaPipe,
 * por eso este approach.
 */

// Declarar los globales que carga index.html
declare global {
  interface Window {
    FaceMesh: any;
    Camera: any;
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ac {
    class FaceMesh {
      constructor(config: { locateFile: (file: string) => string });
      setOptions(options: FaceMeshOptions): void;
      onResults(callback: (results: FaceMeshResults) => void): void;
      send(input: { image: HTMLVideoElement }): Promise<void>;
      close(): void;
    }
  }
}

interface FaceMeshOptions {
  maxNumFaces?: number;
  refineLandmarks?: boolean;
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
}

interface FaceMeshResults {
  multiFaceLandmarks?: Array<
    Array<{ x: number; y: number; z: number }>
  >;
}

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
  leftEyeOuter: NormalizedLandmark;
  rightEyeOuter: NormalizedLandmark;
  leftEyeInner: NormalizedLandmark;
  rightEyeInner: NormalizedLandmark;
  noseBridge: NormalizedLandmark;
  all: NormalizedLandmark[];
}

export type FaceMeshCallback = (result: FaceLandmarksResult | null) => void;

export class FaceTracker {
  private faceMesh: any = null;
  private callback: FaceMeshCallback;
  private debug: boolean;
  private _diagCallback: ((msg: string) => void) | null = null;

  constructor(callback: FaceMeshCallback, debug = false) {
    this.callback = callback;
    this.debug = debug;
    this._diagCallback = null;
  }

  setDiagCallback(cb: ((msg: string) => void) | null) {
    this._diagCallback = cb;
  }

  async initialize(): Promise<void> {
    if (this.faceMesh) return;

    if (!window.FaceMesh) {
      // Causas comunes:
      // 1. index.html no carga <script src="/models/face_mesh.js"> antes del bundle
      // 2. El script tiene crossorigin="anonymous" pero nginx no envía
      //    Access-Control-Allow-Origin → browser descarga pero NO ejecuta
      // 3. Cache del browser con versión vieja
      const hasScriptTag = Array.from(document.scripts).some((s) =>
        s.src.includes('/models/face_mesh.js')
      );
      const scriptTag = Array.from(document.scripts).find((s) =>
        s.src.includes('/models/face_mesh.js')
      );
      const crossorigin = scriptTag?.crossOrigin;

      throw new Error(
        'window.FaceMesh no está disponible.\n' +
          `  - <script> tag presente: ${hasScriptTag}\n` +
          `  - crossorigin attr: ${crossorigin || '(none)'}\n` +
          '  - Si crossorigin="anonymous" está, nginx debe devolver\n' +
          '    Access-Control-Allow-Origin para /models/.\n' +
          '  - Solución: usar crossorigin vacío o "" (same-origin).'
      );
    }

    this.faceMesh = new window.FaceMesh({
      locateFile: (file: string) => `/models/${file}`,
    });

    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      minDetectionConfidence: 0.3,
      minTrackingConfidence: 0.3,
    });

    this.faceMesh.onResults(this.handleResults);

    if (this.debug) {
      console.log('[FaceTracker] Inicializado correctamente');
    }
  }

  private handleResults = (results: FaceMeshResults) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      if (this.debug && Math.random() < 0.02) {
        console.log('[FaceTracker] No face detected');
      }
      this.callback(null);
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];

    if (this.debug && Math.random() < 0.02) {
      console.log('[FaceTracker] Face detected, 468 landmarks');
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

  async processFrame(video: HTMLVideoElement): Promise<void> {
    if (!this.faceMesh) {
      throw new Error('FaceTracker no inicializado. Llama initialize() primero.');
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    if (video.readyState < 2) {
      return;
    }

    try {
      if (!this.frameCanvas) {
        this.frameCanvas = document.createElement('canvas');
      }
      const canvas = this.frameCanvas;
      const srcW = video.videoWidth;
      const srcH = video.videoHeight;

      // Detección de orientación:
      // En Android Chrome, getUserMedia con cámara frontal a veces entrega
      // el frame rotado 90° (videoWidth=1280, videoHeight=720 cuando se ve
      // portrait en pantalla). MediaPipe espera coordenadas upright.
      //
      // Reglas:
      // - Si videoWidth > videoHeight Y el preview es portrait, rotar.
      // - El atributo CSS del <video> lo dice: aspect-ratio del bounding rect.
      const isSrcLandscape = srcW > srcH;
      const videoRect = video.getBoundingClientRect();
      const isDisplayPortrait = videoRect.height > videoRect.width;

      let drawW = srcW;
      let drawH = srcH;
      if (isSrcLandscape && isDisplayPortrait) {
        // Swap: rotar 90° CCW al dibujar
        drawW = srcH;
        drawH = srcW;
        if (canvas.width !== drawW || canvas.height !== drawH) {
          canvas.width = drawW;
          canvas.height = drawH;
        }
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.save();
        ctx.translate(0, canvas.height);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(video, 0, 0, srcW, srcH);
        ctx.restore();
      } else {
        if (canvas.width !== drawW || canvas.height !== drawH) {
          canvas.width = drawW;
          canvas.height = drawH;
        }
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, drawW, drawH);
      }

      // Verificación de contenido: leer pixel central + 4 esquinas.
      // Si todos son negros/transparentes, MediaPipe nunca va a detectar nada.
      if (this.debug) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const samples = [
            { name: 'TL', x: 10, y: 10 },
            { name: 'TR', x: canvas.width - 10, y: 10 },
            { name: 'C', x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) },
            { name: 'BL', x: 10, y: canvas.height - 10 },
            { name: 'BR', x: canvas.width - 10, y: canvas.height - 10 },
          ];
          const pxStr = samples
            .map((s) => {
              const px = ctx.getImageData(s.x, s.y, 1, 1).data;
              return `${s.name}=${px[0]},${px[1]},${px[2]},${px[3]}`;
            })
            .join(' ');
          const msg =
            `[FaceTracker] diag: src=${srcW}x${srcH} ` +
            `rect=${Math.round(videoRect.width)}x${Math.round(videoRect.height)} ` +
            `rotated=${isSrcLandscape && isDisplayPortrait} ` +
            `canvas=${canvas.width}x${canvas.height} ` +
            `px ${pxStr}`;
          if (!this._lastDiagTs || Date.now() - this._lastDiagTs > 2000) {
            this._lastDiagTs = Date.now();
            this._diagCallback?.(msg);
            console.log(msg);
          }
        }
      }

      await this.faceMesh.send({ image: canvas });
    } catch (err) {
      if (this.debug) {
        console.error('[FaceTracker] Error procesando frame:', err);
      }
    }
  }

  private _lastDiagTs = 0;

  private frameCanvas: HTMLCanvasElement | null = null;

  dispose(): void {
    this.faceMesh?.close();
    this.faceMesh = null;
  }
}

export {};