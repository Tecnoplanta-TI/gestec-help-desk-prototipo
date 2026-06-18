import { randomUUID } from 'crypto'
import type { CreateSlaRulePayload, ServiceGroup, SlaRule, TicketPriority, UpdateSlaRulePayload } from '../../shared/types'
import { getContainer } from './cosmos'

const CONTAINER = 'sla_rules'

function normalizeNullable<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : value
}

export async function listSlaRules(): Promise<SlaRule[]> {
  const container = await getContainer(CONTAINER)
  const { resources } = await container.items
    .query<SlaRule>('SELECT * FROM c ORDER BY c.updatedAt DESC')
    .fetchAll()
  return resources
}

export async function createSlaRule(payload: CreateSlaRulePayload): Promise<SlaRule> {
  const container = await getContainer(CONTAINER)
  const now = new Date().toISOString()
  const doc: SlaRule = {
    id: randomUUID(),
    name: payload.name,
    priority: normalizeNullable(payload.priority),
    serviceGroup: normalizeNullable(payload.serviceGroup),
    deadlineHours: payload.deadlineHours,
    createdAt: now,
    updatedAt: now,
  }
  const { resource } = await container.items.create<SlaRule>(doc)
  return resource as SlaRule
}

export async function updateSlaRule(payload: UpdateSlaRulePayload): Promise<SlaRule> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(payload.id, payload.id).read<SlaRule>()
  if (!existing) {
    throw new Error('SLA_RULE_NOT_FOUND')
  }

  const hasPriority = Object.prototype.hasOwnProperty.call(payload, 'priority')
  const hasServiceGroup = Object.prototype.hasOwnProperty.call(payload, 'serviceGroup')

  const updated: SlaRule = {
    ...existing,
    ...payload,
    priority: hasPriority ? normalizeNullable(payload.priority ?? undefined) : existing.priority,
    serviceGroup: hasServiceGroup
      ? normalizeNullable(payload.serviceGroup ?? undefined)
      : existing.serviceGroup,
    updatedAt: new Date().toISOString(),
  }

  const { resource } = await container.item(payload.id, payload.id).replace<SlaRule>(updated)
  return resource as SlaRule
}

export async function deleteSlaRule(ruleId: string): Promise<void> {
  const container = await getContainer(CONTAINER)
  await container.item(ruleId, ruleId).delete()
}

function getSpecificityScore(rule: SlaRule): number {
  const hasPriority = Boolean(rule.priority)
  const hasServiceGroup = Boolean(rule.serviceGroup)
  if (hasPriority && hasServiceGroup) return 4
  if (hasPriority) return 3
  if (hasServiceGroup) return 2
  return 1
}

function isApplicableRule(
  rule: SlaRule,
  priority: TicketPriority,
  serviceGroup: ServiceGroup,
): boolean {
  const priorityMatch = !rule.priority || rule.priority === priority
  const serviceGroupMatch = !rule.serviceGroup || rule.serviceGroup === serviceGroup
  return priorityMatch && serviceGroupMatch
}

export async function findApplicableSlaRule(
  priority: TicketPriority,
  serviceGroup: ServiceGroup,
): Promise<SlaRule | null> {
  const rules = await listSlaRules()
  const applicable = rules.filter((rule) => isApplicableRule(rule, priority, serviceGroup))
  if (applicable.length === 0) return null

  applicable.sort((a, b) => {
    const specificityDiff = getSpecificityScore(b) - getSpecificityScore(a)
    if (specificityDiff !== 0) return specificityDiff
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return applicable[0]
}
