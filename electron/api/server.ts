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
import { isCosmosConfigured } from '../services/cosmos'

const server = Fastify({
  logger: process.env.NODE_ENV === 'development',
})

interface StartApiServerOptions {
  cors?: boolean
}

function applyCors(): void {
  server.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    if (request.method === 'OPTIONS') {
      reply.status(204).send()
    }
  })
}

// ─── Health check ─────────────────────────────────────────────────────────────

server.get('/health', async () => {
  return {
    status: 'ok',
    app: 'gestec-help-desk',
    cosmosConfigured: isCosmosConfigured(),
    timestamp: new Date().toISOString(),
  }
})

registerWebhookRoutes(server)
registerRpcRoutes(server)

// ─── Inicialização ────────────────────────────────────────────────────────────

export async function startApiServer(options: StartApiServerOptions = {}): Promise<void> {
  if (options.cors) applyCors()

  const port = Number(process.env.PORT ?? 3847)
  const host = options.cors ? '0.0.0.0' : '127.0.0.1'

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
