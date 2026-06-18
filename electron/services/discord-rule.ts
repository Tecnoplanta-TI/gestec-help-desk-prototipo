import { randomUUID } from 'crypto'
import type {
  CreateDiscordRulePayload,
  DiscordNotificationRule,
  DiscordTriggerEvent,
  UpdateDiscordRulePayload,
} from '../../shared/types'
import { getContainer } from './cosmos'

const CONTAINER = 'discord_notification_rules'

function normalizeText(value: string): string {
  return value.trim()
}

function normalizeRule(rule: DiscordNotificationRule): DiscordNotificationRule {
  return {
    ...rule,
    name: normalizeText(rule.name),
    webhookUrl: normalizeText(rule.webhookUrl),
    messageTemplate: rule.messageTemplate.trim(),
    conditions: rule.conditions.map((condition) => ({
      ...condition,
      field: normalizeText(condition.field),
      value: Array.isArray(condition.value)
        ? condition.value.map((item) => normalizeText(item))
        : normalizeText(condition.value),
    })),
  }
}

export async function listDiscordRules(): Promise<DiscordNotificationRule[]> {
  const container = await getContainer(CONTAINER)
  const { resources } = await container.items
    .query<DiscordNotificationRule>('SELECT * FROM c ORDER BY c.updatedAt DESC')
    .fetchAll()
  return resources
}

export async function listActiveDiscordRulesByTrigger(
  triggerOn: DiscordTriggerEvent,
): Promise<DiscordNotificationRule[]> {
  const container = await getContainer(CONTAINER)
  const { resources } = await container.items
    .query<DiscordNotificationRule>({
      query: 'SELECT * FROM c WHERE c.triggerOn = @triggerOn AND c.active = true ORDER BY c.updatedAt DESC',
      parameters: [{ name: '@triggerOn', value: triggerOn }],
    })
    .fetchAll()
  return resources
}

export async function createDiscordRule(
  payload: CreateDiscordRulePayload,
): Promise<DiscordNotificationRule> {
  const container = await getContainer(CONTAINER)
  const now = new Date().toISOString()

  const doc = normalizeRule({
    id: randomUUID(),
    name: payload.name,
    webhookUrl: payload.webhookUrl,
    triggerOn: payload.triggerOn,
    conditions: payload.conditions,
    messageTemplate: payload.messageTemplate,
    active: payload.active,
    createdAt: now,
    updatedAt: now,
  })

  const { resource } = await container.items.create<DiscordNotificationRule>(doc)
  return resource as DiscordNotificationRule
}

export async function updateDiscordRule(
  payload: UpdateDiscordRulePayload,
): Promise<DiscordNotificationRule> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(payload.id, payload.id).read<DiscordNotificationRule>()
  if (!existing) throw new Error('DISCORD_RULE_NOT_FOUND')

  const updated = normalizeRule({
    ...existing,
    ...payload,
    updatedAt: new Date().toISOString(),
  })

  const { resource } = await container.item(payload.id, payload.id).replace<DiscordNotificationRule>(updated)
  return resource as DiscordNotificationRule
}

export async function deleteDiscordRule(ruleId: string): Promise<void> {
  const container = await getContainer(CONTAINER)
  await container.item(ruleId, ruleId).delete()
}