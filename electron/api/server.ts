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

const server = Fastify({
  logger: process.env.NODE_ENV === 'development',
})

// ─── Health check ─────────────────────────────────────────────────────────────

server.get('/health', async () => {
  return { status: 'ok', app: 'gestec-help-desk', timestamp: new Date().toISOString() }
})

registerWebhookRoutes(server)

// ─── Inicialização ────────────────────────────────────────────────────────────

export async function startApiServer(): Promise<void> {
  const port = Number(process.env.PORT ?? 3847)
  const host = '127.0.0.1' // somente localhost — sem exposição externa

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
