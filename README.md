# VTO Óptica - Probador Virtual

MVP funcional de Virtual Try-On (VTO) para ópticas. Permite al usuario probar
3 estilos de lentes usando la cámara del navegador con tracking facial en
tiempo real.

## Stack

- **Vite** + **React 18** + **TypeScript** + **Tailwind CSS**
- **MediaPipe Face Mesh** (468 landmarks, 100% client-side)
- **Docker** + **Nginx** para deploy estático

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir [http://localhost:5173](http://localhost:5173).

> **Importante:** La cámara requiere HTTPS o localhost. En desarrollo local
> funciona con `localhost`, pero para probar en móvil necesitas un tunnel
> HTTPS (cloudflared, ngrok, etc.).

## Build

```bash
npm run build
npm run preview  # sirve el build en :4173
```

## Deploy

El proyecto está configurado para deploy en **Coolify** (o cualquier
plataforma con Docker):

```bash
docker build -t vto-optica .
docker run -p 80:80 vto-optica
```

Coolify detecta el `Dockerfile` automáticamente y lo construye.

## Estructura

```
src/
├── components/
│   ├── CameraView.tsx       # Captura de cámara
│   ├── GlassesOverlay.tsx   # Canvas que dibuja el lente
│   └── LensSelector.tsx     # UI selector inferior
├── lib/
│   ├── catalog.ts           # Catálogo hardcodeado
│   ├── faceTracking.ts      # Wrapper MediaPipe
│   └── lensTransform.ts     # Cálculo pos/rot/escala
├── types/lens.ts
├── App.tsx
└── main.tsx

public/lenses/               # PNGs de los lentes (con transparencia)
```

## Agregar lentes nuevos

1. Sube el PNG con fondo transparente a `public/lenses/`
2. Agrega una entrada en `src/lib/catalog.ts` con el path y dimensiones
3. Rebuild

## Limitaciones conocidas

- Requiere HTTPS (o localhost) para acceder a la cámara
- iOS Safari: el tracking funciona pero el primer load puede tardar 3-5s
  mientras MediaPipe descarga el modelo
- Iluminación pobre degrada la detección
- 2D simple: el lente no se deforma en perfiles extremos (>60° de rotación)

## Licencia

MIT. Los PNGs de los lentes son CC0 (creados desde cero para este proyecto).