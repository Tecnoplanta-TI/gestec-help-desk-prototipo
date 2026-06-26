import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/** Vite config para desenvolvimento e build no navegador (sem Electron). */
export default defineConfig({
  root: '.',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3847',
      '/health': 'http://127.0.0.1:3847',
    },
  },
  build: {
    outDir: 'dist-web',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
})
