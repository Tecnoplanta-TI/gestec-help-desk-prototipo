import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    // Main Process — Node.js environment
    build: {
      outDir: 'dist-electron',
      lib: {
        entry: resolve(__dirname, 'electron/main.ts'),
      },
    },
  },
  preload: {
    // Preload script — limited Node.js access via contextBridge
    build: {
      outDir: 'dist-electron',
      lib: {
        entry: resolve(__dirname, 'electron/preload.ts'),
      },
    },
  },
  renderer: {
    // Renderer Process — browser environment
    root: '.',
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, 'shared'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3847',
          changeOrigin: true,
        },
      },
    },
  },
})
