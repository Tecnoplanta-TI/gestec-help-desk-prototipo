import { rpcHandle } from './rpc-handle'
import { z } from 'zod'
import { resolveAuthenticatedUser } from '../services/session-user'
import {
  createSlaRule,
  deleteSlaRule,
  listSlaRules,
  updateSlaRule,
} from '../services/sla-rule'

const SlaRuleBaseSchema = z.object({
  name: z.string().min(2).max(120),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
  serviceGroup: z
    .enum([
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
    ])
    .optional(),
  deadlineHours: z.number().positive().max(24 * 365),
})

const CreateSlaRuleSchema = SlaRuleBaseSchema
const UpdateSlaRuleSchema = SlaRuleBaseSchema.partial().extend({
  id: z.string().uuid(),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']).nullable().optional(),
  serviceGroup: z
    .enum([
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
    ])
    .nullable()
    .optional(),
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

export function registerSlaHandlers(): void {
  rpcHandle('sla:list', async () => {
    await requireAuthenticatedUser()
    return listSlaRules()
  })

  rpcHandle('sla:create', async (_event, payload: unknown) => {
    await requireAdminUser()
    const parsed = CreateSlaRuleSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    return createSlaRule(parsed.data)
  })

  rpcHandle('sla:update', async (_event, payload: unknown) => {
    await requireAdminUser()
    const parsed = UpdateSlaRuleSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    return updateSlaRule(parsed.data)
  })

  rpcHandle('sla:delete', async (_event, ruleId: unknown) => {
    await requireAdminUser()
    const parsed = z.string().uuid().safeParse(ruleId)
    if (!parsed.success) ipcError('INVALID_INPUT')
    await deleteSlaRule(parsed.data)
  })
}
