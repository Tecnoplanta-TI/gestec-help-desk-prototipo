import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { invokeRegisteredRpc } from '../../ipc/rpc-handle'

const RpcBodySchema = z.object({
  channel: z.string().min(1),
  args: z.array(z.unknown()).default([]),
})

function extractBearerToken(authorization?: string): string | undefined {
  if (!authorization?.startsWith('Bearer ')) return undefined
  const token = authorization.slice('Bearer '.length).trim()
  return token || undefined
}

export function registerRpcRoutes(server: FastifyInstance): void {
  server.post('/api/rpc', async (request, reply) => {
    const parsed = RpcBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ code: 'INVALID_INPUT', message: 'Payload RPC inválido' })
    }

    const token = extractBearerToken(request.headers.authorization)

    try {
      const result = await invokeRegisteredRpc(parsed.data.channel, parsed.data.args, token)
      return { result }
    } catch (error) {
      const err = error as Error & { code?: string }
      const code = err.code ?? 'INTERNAL_ERROR'
      const status = code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : 400
      return reply.status(status).send({ code, message: err.message || code })
    }
  })
}
