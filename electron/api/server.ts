/**
 * electron/api/server.ts — Servidor Fastify interno
 *
 * Expõe uma API REST local usada para:
 * - Receber webhooks da plataforma externa de processos (tickets de entrada)
 * - Fornecer endpoints para integrações futuras
 *
 * Roda exclusivamente no Main Process (Node.js).
 * Porta padrão: 3847 (configurável via variável de ambiente PORT)
 */

import Fastify from 'fastify'
import { registerWebhookRoutes } from './routes/webhooks'
import { registerRpcRoutes } from './routes/rpc'

const server = Fastify({
  logger: process.env.NODE_ENV === 'development',
})

// ─── Health check ─────────────────────────────────────────────────────────────

server.get('/health', async () => {
  return { status: 'ok', app: 'gestec-help-desk', timestamp: new Date().toISOString() }
})

registerWebhookRoutes(server)
registerRpcRoutes(server)

const DEV_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])

server.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin
  if (origin && DEV_ORIGINS.has(origin)) {
    reply.header('Access-Control-Allow-Origin', origin)
    reply.header('Access-Control-Allow-Credentials', 'true')
    reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }

  if (request.method === 'OPTIONS') {
    return reply.status(204).send()
  }
})

// ─── Inicialização ────────────────────────────────────────────────────────────

export async function startApiServer(): Promise<void> {
  const port = Number(process.env.PORT ?? 3847)
  const host = process.env.API_HOST ?? '127.0.0.1'

  try {
    await server.listen({ port, host })
    console.log(`[API] Servidor interno rodando em http://${host}:${port}`)
  } catch (err) {
    console.error('[API] Falha ao iniciar servidor:', err)
    throw err
  }
}

export async function stopApiServer(): Promise<void> {
  if (server.listeningOrigin) {
    await server.close()
  }
}

export { server }
