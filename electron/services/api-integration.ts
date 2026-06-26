import { randomUUID } from 'crypto'
import type {
  ApiIntegration,
  ApiIntegrationKeyValue,
  CreateApiIntegrationPayload,
  UpdateApiIntegrationPayload,
} from '../../shared/types'
import { getContainer } from './cosmos'

const CONTAINER = 'api_integrations'

const EXAMPLE_DISCORD_BODY = `{
  "content": "🚨 P1 — {ticket.ticketNumber}\\nAbertura: {ticket.openedAt}\\nSolicitante: {ticket.requester.name}\\nTipo: {ticket.type}\\n{ticket.title}",
  "username": "gestec · help desk"
}`

function normalizePairs(items: ApiIntegrationKeyValue[] | undefined): ApiIntegrationKeyValue[] {
  return (items ?? [])
    .map((item) => ({ key: item.key.trim(), value: item.value.trim() }))
    .filter((item) => item.key)
}

function normalizeIntegration(doc: ApiIntegration): ApiIntegration {
  return {
    ...doc,
    name: doc.name.trim(),
    url: doc.url.trim(),
    parameters: normalizePairs(doc.parameters),
    headers: normalizePairs(doc.headers),
    accessoryFields: normalizePairs(doc.accessoryFields),
  }
}

async function seedExampleIfEmpty(): Promise<void> {
  const container = await getContainer(CONTAINER)
  const { resources } = await container.items
    .query<ApiIntegration>('SELECT TOP 1 c.id FROM c')
    .fetchAll()
  if (resources.length > 0) return

  const now = new Date().toISOString()
  await container.items.create<ApiIntegration>(
    normalizeIntegration({
      id: randomUUID(),
      name: 'API - Enviar P1 ao Discord',
      kind: 'rest_json',
      method: 'POST',
      url: 'https://discord.com/api/webhooks/SEU_WEBHOOK',
      body: EXAMPLE_DISCORD_BODY,
      authType: 'bearer',
      authToken: '',
      parameters: [],
      headers: [
        { key: 'User-Agent', value: 'gestec-help-desk/1.0' },
        { key: 'Content-Type', value: 'application/json' },
      ],
      transformFilter: '',
      transformValue: '',
      transformText: '',
      transformSort: '',
      transformErrorMessage: '',
      transformFriendlyMessage: '',
      accessoryFields: [],
      locked: true,
      createdById: 'system',
      createdByName: 'Sistema',
      createdAt: now,
      updatedAt: now,
    }),
  )
}

export async function listApiIntegrations(): Promise<ApiIntegration[]> {
  await seedExampleIfEmpty()
  const container = await getContainer(CONTAINER)
  const { resources } = await container.items
    .query<ApiIntegration>('SELECT * FROM c ORDER BY c.updatedAt DESC')
    .fetchAll()
  return resources
}

export async function getApiIntegrationById(id: string): Promise<ApiIntegration> {
  const container = await getContainer(CONTAINER)
  const { resource } = await container.item(id, id).read<ApiIntegration>()
  if (!resource) throw new Error('API_INTEGRATION_NOT_FOUND')
  return resource
}

export async function createApiIntegration(
  payload: CreateApiIntegrationPayload,
  user: { id: string; name: string },
): Promise<ApiIntegration> {
  const container = await getContainer(CONTAINER)
  const now = new Date().toISOString()

  const doc = normalizeIntegration({
    id: randomUUID(),
    name: payload.name,
    kind: payload.kind ?? 'rest_json',
    method: payload.method,
    url: payload.url,
    body: payload.body,
    authType: payload.authType ?? 'none',
    authToken: payload.authToken,
    parameters: payload.parameters ?? [],
    headers: payload.headers ?? [],
    transformFilter: payload.transformFilter,
    transformValue: payload.transformValue,
    transformText: payload.transformText,
    transformSort: payload.transformSort,
    transformErrorMessage: payload.transformErrorMessage,
    transformFriendlyMessage: payload.transformFriendlyMessage,
    accessoryFields: payload.accessoryFields ?? [],
    locked: payload.locked ?? false,
    createdById: user.id,
    createdByName: user.name,
    createdAt: now,
    updatedAt: now,
  })

  const { resource } = await container.items.create<ApiIntegration>(doc)
  return resource as ApiIntegration
}

export async function updateApiIntegration(
  payload: UpdateApiIntegrationPayload,
): Promise<ApiIntegration> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(payload.id, payload.id).read<ApiIntegration>()
  if (!existing) throw new Error('API_INTEGRATION_NOT_FOUND')

  const updated = normalizeIntegration({
    ...existing,
    ...payload,
    updatedAt: new Date().toISOString(),
  })

  const { resource } = await container.item(payload.id, payload.id).replace<ApiIntegration>(updated)
  return resource as ApiIntegration
}

export async function deleteApiIntegration(id: string): Promise<void> {
  const container = await getContainer(CONTAINER)
  await container.item(id, id).delete()
}
