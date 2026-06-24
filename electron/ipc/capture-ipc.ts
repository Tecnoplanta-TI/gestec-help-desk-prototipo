/**
 * Intercepta ipcMain.handle para registrar handlers no rpc-registry.
 * Deve ser importado antes de qualquer register*Handlers().
 */

import { ipcMain } from 'electron'
import { registerRpcHandler } from './rpc-registry'

let installed = false

export function installIpcRpcCapture(): void {
  if (installed) return
  installed = true

  const originalHandle = ipcMain.handle.bind(ipcMain)

  ipcMain.handle = function patchedHandle(
    channel: string,
    listener: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>,
  ): void {
    registerRpcHandler(channel, (...args: unknown[]) => listener({} as Electron.IpcMainInvokeEvent, ...args))
    originalHandle(channel, listener)
  } as typeof ipcMain.handle
}
