import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/** Vite standalone para desenvolvimento no navegador (sem janela Electron). */
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
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3847',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist-web',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
})
