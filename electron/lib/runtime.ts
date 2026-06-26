/** Indica se o backend está rodando no processo principal do Electron em desenvolvimento. */
export function isElectronDev(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return isElectronRuntime() && !isElectronPackaged()
}

/** Indica se o módulo electron está disponível (processo principal). */
export function isElectronRuntime(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    return Boolean(app)
  } catch {
    return false
  }
}

function isElectronPackaged(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    return app.isPackaged
  } catch {
    return false
  }
}
