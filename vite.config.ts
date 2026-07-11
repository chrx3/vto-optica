import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Necesario para acceso via HTTPS en testing móvil (cloudflared/ngrok)
    strictPort: false,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // MediaPipe es pesado, lo separamos en su propio chunk
    // MediaPipe se carga via <script> en index.html (UMD), no se bundlea.
    // El manualChunks ya no es necesario.
  },
})