import type { FastifyInstance } from 'fastify'

/**
 * Webhook Zeev descontinuado — substituição 100% pelo app próprio.
 * @see specs/zeev-migration/decisions.md
 */
export function registerWebhookRoutes(server: FastifyInstance): void {
  server.post('/webhooks/ticket', async (_request, reply) => {
    return reply.code(410).send({
      error: 'WEBHOOK_DEPRECATED',
      message:
        'Integração Zeev via webhook foi descontinuada. Utilize o gestec · help desk para abertura de tickets.',
    })
  })
}
