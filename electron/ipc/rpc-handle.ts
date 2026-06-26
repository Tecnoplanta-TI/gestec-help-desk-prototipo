import type { IpcMainInvokeEvent } from 'electron'
import { runWithAuthToken } from '../services/request-context'

export type IpcHandler = (
  event: IpcMainInvokeEvent,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) => unknown | Promise<unknown>

const registry = new Map<string, IpcHandler>()

let ipcBinder: ((channel: string, handler: IpcHandler) => void) | null = null

/** Liga handlers já registrados ao ipcMain (Electron). */
export function bindRpcToIpcMain(
  bind: (channel: string, handler: IpcHandler) => void,
): void {
  ipcBinder = bind
  for (const [channel, handler] of registry) {
    bind(channel, handler)
  }
}

/** Registra handler IPC (Electron + HTTP RPC). */
export function rpcHandle(channel: string, handler: IpcHandler): void {
  registry.set(channel, handler)
  ipcBinder?.(channel, handler)
}

export function isRpcChannelRegistered(channel: string): boolean {
  return registry.has(channel)
}

export async function invokeRegisteredRpc(
  channel: string,
  args: unknown[],
  authToken?: string,
): Promise<unknown> {
  const handler = registry.get(channel)
  if (!handler) {
    throw Object.assign(new Error(`Canal IPC desconhecido: ${channel}`), { code: 'UNKNOWN_CHANNEL' })
  }

  return runWithAuthToken(authToken, async () => {
    return handler({} as IpcMainInvokeEvent, ...args)
  })
}
