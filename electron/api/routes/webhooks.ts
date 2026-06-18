import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { createTicket } from '../../services/ticket'
import {
  mapExternalToInternalTicket,
  parseExternalTicketPayload,
} from '../../services/platform-integration'

export function registerWebhookRoutes(server: FastifyInstance): void {
  server.post('/webhooks/ticket', async (request, reply) => {
    const configuredSecret = process.env['PLATFORM_WEBHOOK_SECRET']
    if (!configuredSecret) {
      return reply.code(500).send({ error: 'WEBHOOK_NOT_CONFIGURED' })
    }

    const incomingSecret = request.headers['x-webhook-secret']
    if (incomingSecret !== configuredSecret) {
      return reply.code(401).send({ error: 'UNAUTHORIZED' })
    }

    try {
      const externalPayload = parseExternalTicketPayload(request.body)
      const ticket = await createTicket(mapExternalToInternalTicket(externalPayload))
      return reply.code(201).send({ id: ticket.id, externalId: ticket.externalId })
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: 'INVALID_PAYLOAD',
          issues: error.issues,
        })
      }
      if (error instanceof Error && error.message.includes('WORKFLOW_NOT_CONFIGURED')) {
        return reply.code(503).send({ error: 'WORKFLOW_NOT_CONFIGURED' })
      }
      request.log.error(error)
      return reply.code(500).send({ error: 'INTERNAL_ERROR' })
    }
  })
}
