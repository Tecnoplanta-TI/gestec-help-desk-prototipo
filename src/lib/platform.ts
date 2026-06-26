/** Detecta se o app está rodando dentro do Electron (preload disponível). */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI)
}
