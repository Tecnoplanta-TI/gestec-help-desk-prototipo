import { rpcHandle } from './rpc-handle'
import { z } from 'zod'
import {
  createDiscordRule,
  deleteDiscordRule,
  listDiscordRules,
  updateDiscordRule,
} from '../services/discord-rule'
import { resolveAuthenticatedUser } from '../services/session-user'

const DiscordConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['equal', 'not_equal', 'in', 'contains']),
  value: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
})

const CreateDiscordRuleSchema = z.object({
  name: z.string().min(2).max(120),
  webhookUrl: z.string().url().refine((value) => value.startsWith('https://'), 'HTTPS_REQUIRED'),
  triggerOn: z.enum([
    'ticket_created',
    'ticket_status_changed',
    'ticket_assigned',
    'ticket_sla_warning',
    'ticket_sla_overdue',
    'ticket_closed',
  ]),
  conditions: z.array(DiscordConditionSchema),
  messageTemplate: z.string().min(1).max(1900),
  active: z.boolean(),
})

const UpdateDiscordRuleSchema = CreateDiscordRuleSchema.partial().extend({
  id: z.string().uuid(),
})

function ipcError(code: string, message?: string): never {
  throw Object.assign(new Error(message ?? code), { code })
}

async function requireAuthenticatedUser() {
  const user = await resolveAuthenticatedUser()
  if (!user) ipcError('UNAUTHORIZED')
  return user
}

async function requireAdminUser() {
  const user = await requireAuthenticatedUser()
  if (user.role !== 'admin') ipcError('FORBIDDEN')
  return user
}

function mapServiceError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('DISCORD_RULE_NOT_FOUND')) ipcError('DISCORD_RULE_NOT_FOUND')
  throw error
}

export function registerDiscordHandlers(): void {
  rpcHandle('discord:list-rules', async () => {
    await requireAuthenticatedUser()
    return listDiscordRules()
  })

  rpcHandle('discord:create-rule', async (_event, payload: unknown) => {
    await requireAdminUser()
    const parsed = CreateDiscordRuleSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await createDiscordRule(parsed.data)
    } catch (error) {
      mapServiceError(error)
    }
  })

  rpcHandle('discord:update-rule', async (_event, payload: unknown) => {
    await requireAdminUser()
    const parsed = UpdateDiscordRuleSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await updateDiscordRule(parsed.data)
    } catch (error) {
      mapServiceError(error)
    }
  })

  rpcHandle('discord:delete-rule', async (_event, ruleId: unknown) => {
    await requireAdminUser()
    const parsed = z.string().uuid().safeParse(ruleId)
    if (!parsed.success) ipcError('INVALID_INPUT')

    await deleteDiscordRule(parsed.data)
  })
}
