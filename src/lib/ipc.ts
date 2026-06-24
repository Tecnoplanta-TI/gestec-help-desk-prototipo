/**
 * src/lib/ipc.ts
 *
 * Wrapper tipado para `window.electronAPI`.
 * Use sempre esta exportação nos componentes e hooks do Renderer —
 * nunca acesse `window.electronAPI` diretamente.
 *
 * Motivo: centraliza o ponto de acesso, facilita mocking em testes
 * e fornece mensagem de erro clara caso o preload não tenha sido carregado.
 */

import type { ElectronAPI } from '../../shared/types'

function getElectronAPI(): ElectronAPI {
  if (typeof window === 'undefined' || !window.electronAPI) {
    throw new Error(
      '[ipc] window.electronAPI não está disponível. ' +
        'Verifique se o preload script foi carregado corretamente.',
    )
  }
  return window.electronAPI
}

export const ipc: ElectronAPI = new Proxy({} as ElectronAPI, {
  get(_target, prop: string) {
    return getElectronAPI()[prop as keyof ElectronAPI]
  },
})
