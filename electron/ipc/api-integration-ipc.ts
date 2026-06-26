import { rpcHandle } from './rpc-handle'
import { z } from 'zod'
import { resolveAuthenticatedUser } from '../services/session-user'
import {
  createApiIntegration,
  deleteApiIntegration,
  getApiIntegrationById,
  listApiIntegrations,
  updateApiIntegration,
} from '../services/api-integration'

const KeyValueSchema = z.object({
  key: z.string().max(200),
  value: z.string().max(4000),
})

const IntegrationBodySchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(['rest_json', 'sql', 'fixed']).optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  url: z.string().min(1).max(2000),
  body: z.string().max(20000).optional(),
  authType: z.enum(['none', 'bearer']).optional(),
  authToken: z.string().max(4000).optional(),
  parameters: z.array(KeyValueSchema).optional(),
  headers: z.array(KeyValueSchema).optional(),
  transformFilter: z.string().max(500).optional(),
  transformValue: z.string().max(500).optional(),
  transformText: z.string().max(500).optional(),
  transformSort: z.string().max(500).optional(),
  transformErrorMessage: z.string().max(500).optional(),
  transformFriendlyMessage: z.string().max(500).optional(),
  accessoryFields: z.array(KeyValueSchema).optional(),
  locked: z.boolean().optional(),
})

function ipcError(code: string, message?: string): never {
  throw Object.assign(new Error(message ?? code), { code })
}

async function requireAdmin() {
  const user = await resolveAuthenticatedUser()
  if (!user) ipcError('UNAUTHORIZED')
  if (user.role !== 'admin' && !user.permissions.includes('admin')) ipcError('FORBIDDEN')
  return user
}

export function registerApiIntegrationHandlers(): void {
  rpcHandle('integration:list', async () => {
    await requireAdmin()
    return listApiIntegrations()
  })

  rpcHandle('integration:get-by-id', async (_event, integrationId: string) => {
    await requireAdmin()
    if (!z.string().uuid().safeParse(integrationId).success) ipcError('INVALID_INPUT')
    try {
      return await getApiIntegrationById(integrationId)
    } catch {
      ipcError('API_INTEGRATION_NOT_FOUND')
    }
  })

  rpcHandle('integration:create', async (_event, payload: unknown) => {
    const user = await requireAdmin()
    const parsed = IntegrationBodySchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    return createApiIntegration(parsed.data, user)
  })

  rpcHandle('integration:update', async (_event, payload: unknown) => {
    await requireAdmin()
    const parsed = IntegrationBodySchema.extend({ id: z.string().uuid() }).safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    try {
      return await updateApiIntegration(parsed.data)
    } catch {
      ipcError('API_INTEGRATION_NOT_FOUND')
    }
  })

  rpcHandle('integration:delete', async (_event, integrationId: unknown) => {
    await requireAdmin()
    if (!z.string().uuid().safeParse(integrationId).success) ipcError('INVALID_INPUT')
    try {
      await deleteApiIntegration(integrationId as string)
    } catch {
      ipcError('API_INTEGRATION_NOT_FOUND')
    }
  })
}
