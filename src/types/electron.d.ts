/**
 * src/types/electron.d.ts
 *
 * Declaração global de `window.electronAPI` para o TypeScript do Renderer.
 * Garante autocompletar e tipagem segura sem importar o módulo Electron
 * diretamente no browser.
 */

import type { ElectronAPI } from '../../shared/types'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
