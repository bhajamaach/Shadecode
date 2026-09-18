import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // MapLibre GL JS ships its own web worker bundle (maplibre-gl-worker.mjs).
    // Vite's esbuild-based dependency pre-bundler doesn't carry that worker
    // file along correctly, so the worker silently fails to load — the map
    // still constructs (WebGL context, canvas, etc. all report fine) but
    // nothing ever actually renders, since MapLibre offloads tile parsing/
    // rendering setup to that worker. Excluding it from pre-bundling makes
    // Vite serve it straight from node_modules instead, where the worker
    // file resolves correctly.
    exclude: ['maplibre-gl'],
  },
})
