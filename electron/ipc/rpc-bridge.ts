import { ipcMain } from 'electron'
import { bindRpcToIpcMain } from './rpc-handle'

let bridgeInstalled = false

/** Liga rpcHandle ao ipcMain do Electron. */
export function installIpcRpcBridge(): void {
  if (bridgeInstalled) return
  bridgeInstalled = true
  bindRpcToIpcMain((channel, handler) => ipcMain.handle(channel, handler))
}

export { invokeRegisteredRpc, isRpcChannelRegistered } from './rpc-handle'
