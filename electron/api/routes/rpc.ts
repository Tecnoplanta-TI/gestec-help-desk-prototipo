/**
 * electron/api/routes/rpc.ts — API HTTP para o renderer no navegador
 */

import type { FastifyInstance } from 'fastify'
import { invokeRpc } from '../../ipc/rpc-registry'
import { runWithAuthToken } from '../../services/request-auth'

interface RpcBody {
  channel: string
  args?: unknown[]
}

function extractBearerToken(authHeader?: string): string | undefined {
  if (!authHeader?.startsWith('Bearer ')) return undefined
  return authHeader.slice(7).trim() || undefined
}

function serializeError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR'
    return { code, message: error.message || code }
  }
  return { code: 'INTERNAL_ERROR', message: String(error) }
}

export function registerRpcRoutes(app: FastifyInstance): void {
  app.post<{ Body: RpcBody }>('/api/rpc', async (request, reply) => {
    const { channel, args = [] } = request.body ?? {}
    if (!channel || typeof channel !== 'string') {
      return reply.status(400).send({ code: 'INVALID_INPUT', message: 'channel obrigatório' })
    }
    if (!Array.isArray(args)) {
      return reply.status(400).send({ code: 'INVALID_INPUT', message: 'args deve ser array' })
    }

    const token = extractBearerToken(request.headers.authorization)

    try {
      const data = await runWithAuthToken(token, () => invokeRpc(channel, args))
      return { data }
    } catch (error) {
      const { code, message } = serializeError(error)
      const status =
        code === 'UNAUTHORIZED'
          ? 401
          : code === 'FORBIDDEN'
            ? 403
            : code === 'INVALID_INPUT' || code === 'INVALID_CREDENTIALS'
              ? 400
              : code === 'NOT_FOUND'
                ? 404
                : 500
      return reply.status(status).send({ code, message })
    }
  })
}
