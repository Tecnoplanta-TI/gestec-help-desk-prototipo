/**
 * Registro central de handlers RPC — usado pelo IPC (Electron) e pela API HTTP (browser).
 */

type RpcHandler = (...args: unknown[]) => Promise<unknown>

const handlers = new Map<string, RpcHandler>()

export function registerRpcHandler(channel: string, handler: RpcHandler): void {
  handlers.set(channel, handler)
}

export async function invokeRpc(channel: string, args: unknown[]): Promise<unknown> {
  const handler = handlers.get(channel)
  if (!handler) {
    throw Object.assign(new Error(`RPC channel not found: ${channel}`), { code: 'NOT_FOUND' })
  }
  return handler(...args)
}

export function listRpcChannels(): string[] {
  return [...handlers.keys()]
}
