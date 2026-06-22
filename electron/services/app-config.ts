import { randomUUID } from 'crypto'
import type { AppConfig, CostCenter, CreateCostCenterPayload, UpdateCostCenterPayload } from '../../shared/types'
import { getContainer } from './cosmos'

const CONTAINER = 'app_config'
const CONFIG_ID = 'default'

const DEFAULT_CONFIG: AppConfig = {
  id: 'default',
  npsLowScoreThreshold: 6,
  adjustmentTimeoutDays: 7,
  adjustmentTimeoutEnabled: false,
  emailEnabled: false,
  updatedAt: new Date().toISOString(),
}

export async function getAppConfig(): Promise<AppConfig> {
  const container = await getContainer(CONTAINER)
  try {
    const { resource } = await container.item(CONFIG_ID, CONFIG_ID).read<AppConfig>()
    return resource ?? DEFAULT_CONFIG
  } catch {
    await container.items.create(DEFAULT_CONFIG)
    return DEFAULT_CONFIG
  }
}

export async function updateAppConfig(
  payload: Partial<Omit<AppConfig, 'id'>>,
): Promise<AppConfig> {
  const container = await getContainer(CONTAINER)
  const current = await getAppConfig()
  const updated: AppConfig = {
    ...current,
    ...payload,
    id: 'default',
    updatedAt: new Date().toISOString(),
  }
  const { resource } = await container.item(CONFIG_ID, CONFIG_ID).replace(updated)
  return resource as AppConfig
}

const CC_CONTAINER = 'cost_centers'

export async function listCostCenters(): Promise<CostCenter[]> {
  const container = await getContainer(CC_CONTAINER)
  const { resources } = await container.items
    .query<CostCenter>('SELECT * FROM c WHERE c.active = true ORDER BY c.code ASC')
    .fetchAll()
  if (resources.length === 0) {
    return seedDefaultCostCenters()
  }
  return resources
}

async function seedDefaultCostCenters(): Promise<CostCenter[]> {
  const container = await getContainer(CC_CONTAINER)
  const now = new Date().toISOString()
  const defaults: CostCenter[] = [
    { id: randomUUID(), code: '47', name: 'Centro de custo 47', active: true, createdAt: now, updatedAt: now },
  ]
  for (const cc of defaults) {
    await container.items.create(cc)
  }
  return defaults
}

export async function createCostCenter(payload: CreateCostCenterPayload): Promise<CostCenter> {
  const container = await getContainer(CC_CONTAINER)
  const now = new Date().toISOString()
  const cc: CostCenter = {
    id: randomUUID(),
    code: payload.code.trim(),
    name: payload.name.trim(),
    active: true,
    createdAt: now,
    updatedAt: now,
  }
  const { resource } = await container.items.create(cc)
  return resource as CostCenter
}

export async function updateCostCenter(payload: UpdateCostCenterPayload): Promise<CostCenter> {
  const container = await getContainer(CC_CONTAINER)
  const { resource: existing } = await container.item(payload.id, payload.id).read<CostCenter>()
  if (!existing) throw new Error('COST_CENTER_NOT_FOUND')
  const updated: CostCenter = {
    ...existing,
    ...(payload.code !== undefined ? { code: payload.code.trim() } : {}),
    ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
    ...(payload.active !== undefined ? { active: payload.active } : {}),
    updatedAt: new Date().toISOString(),
  }
  const { resource } = await container.item(payload.id, payload.id).replace(updated)
  return resource as CostCenter
}
