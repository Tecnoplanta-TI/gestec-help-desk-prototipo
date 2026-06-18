import { z } from 'zod'
import type { CreateTicketInput } from './ticket'

const ExternalTicketSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(3),
  description: z.string().min(3),
  requester: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    costCenter: z.string().min(1),
  }),
  type: z.enum(['incident', 'service_interruption', 'improvement', 'request']),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']),
  serviceGroup: z.enum([
    'access_accounts',
    'acquisitions',
    'dashboards',
    'emails',
    'gestec',
    'printers',
    'maintenance_upgrade',
    'software',
    'network_internet',
    'erp',
    'process_platform',
    'other',
  ]),
})

export type ExternalTicketPayload = z.infer<typeof ExternalTicketSchema>

export function parseExternalTicketPayload(payload: unknown): ExternalTicketPayload {
  return ExternalTicketSchema.parse(payload)
}

export function mapExternalToInternalTicket(payload: ExternalTicketPayload): CreateTicketInput {
  return {
    source: 'external',
    externalId: payload.id,
    title: payload.title,
    description: payload.description,
    requesterName: payload.requester.name,
    requesterEmail: payload.requester.email,
    costCenter: payload.requester.costCenter,
    type: payload.type,
    priority: payload.priority,
    serviceGroup: payload.serviceGroup,
  }
}
