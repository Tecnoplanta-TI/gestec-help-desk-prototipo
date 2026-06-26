/**
 * src/lib/ipc.ts
 *
 * Wrapper tipado para comunicação com o backend.
 * No Electron usa window.electronAPI (preload); no navegador usa HTTP RPC.
 */

import type { ElectronAPI } from '../../shared/types'
import { browserAPI } from './browser-api'
import { isElectron } from './platform'

function getAPI(): ElectronAPI {
  if (isElectron()) {
    if (!window.electronAPI) {
      throw new Error(
        '[ipc] window.electronAPI não está disponível. ' +
          'Verifique se o preload script foi carregado corretamente.',
      )
    }
    return window.electronAPI
  }
  return browserAPI
}

export const ipc: ElectronAPI = new Proxy({} as ElectronAPI, {
  get(_target, prop: string) {
    return getAPI()[prop as keyof ElectronAPI]
  },
})
