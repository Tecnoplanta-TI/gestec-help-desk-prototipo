/**
 * src/lib/ipc.ts
 *
 * Ponto único de acesso à API do backend:
 * - Electron: window.electronAPI (preload)
 * - Navegador: HTTP POST /api/rpc (ver http-api.ts)
 */

import type { ElectronAPI } from '../../shared/types'
import { httpApi } from './http-api'

function isElectronRenderer(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI)
}

function getApi(): ElectronAPI {
  if (isElectronRenderer()) {
    return window.electronAPI!
  }
  return httpApi
}

export const ipc: ElectronAPI = new Proxy({} as ElectronAPI, {
  get(_target, prop: string) {
    const api = getApi()
    const value = api[prop as keyof ElectronAPI]
    if (typeof value === 'function') {
      return value.bind(api)
    }
    return value
  },
})

export const isBrowserMode = !isElectronRenderer()
