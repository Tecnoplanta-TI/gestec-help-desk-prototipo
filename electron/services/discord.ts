import type {
  DiscordCondition,
  DiscordNotificationRule,
  DiscordTriggerEvent,
  Ticket,
  User,
} from '../../shared/types'
import { listActiveDiscordRulesByTrigger } from './discord-rule'
import { findUserById } from './user'

interface DiscordNotifyContext {
  ticket: Ticket
  previousTicket?: Ticket
}

function readPathValue(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, source)
}

function normalizeToStringArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value.map((item) => item.trim()) : [value.trim()]
}

function conditionMatches(ruleCondition: DiscordCondition, context: Record<string, unknown>): boolean {
  const actual = readPathValue(context, ruleCondition.field)
  const actualStr = String(actual ?? '')
  const expected = normalizeToStringArray(ruleCondition.value)

  if (ruleCondition.operator === 'equal') {
    return expected.includes(actualStr)
  }

  if (ruleCondition.operator === 'not_equal') {
    return !expected.includes(actualStr)
  }

  if (ruleCondition.operator === 'in') {
    return expected.includes(actualStr)
  }

  return expected.some((value) => actualStr.includes(value))
}

function evaluateConditions(rule: DiscordNotificationRule, context: Record<string, unknown>): boolean {
  if (rule.conditions.length === 0) return true
  return rule.conditions.every((condition) => conditionMatches(condition, context))
}

function resolveTemplateValue(context: Record<string, unknown>, key: string): string {
  const value = readPathValue(context, key)
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') return ''
  return String(value)
}

function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{([^{}]+)\}/g, (_match, key: string) => {
    const normalized = key.trim()
    return resolveTemplateValue(context, normalized)
  })
}

async function sendWebhook(webhookUrl: string, content: string): Promise<void> {
  const payload = {
    content: content.slice(0, 1900),
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`DISCORD_WEBHOOK_FAILED:${response.status}`)
  }
}

async function buildContextPayload(ticket: Ticket): Promise<Record<string, unknown>> {
  const assignee: User | null = ticket.assigneeId ? await findUserById(ticket.assigneeId) : null

  return {
    ticket,
    requester: ticket.requester,
    assignee: assignee ?? {},
  }
}

export async function notifyDiscord(
  triggerOn: DiscordTriggerEvent,
  context: DiscordNotifyContext,
): Promise<void> {
  const rules = await listActiveDiscordRulesByTrigger(triggerOn)
  if (rules.length === 0) return

  const payloadContext = await buildContextPayload(context.ticket)

  for (const rule of rules) {
    try {
      const mergedContext: Record<string, unknown> = {
        ...payloadContext,
        previousTicket: context.previousTicket ?? {},
      }

      if (!evaluateConditions(rule, mergedContext)) {
        continue
      }

      const message = renderTemplate(rule.messageTemplate, mergedContext)
      if (!message.trim()) {
        continue
      }

      await sendWebhook(rule.webhookUrl, message)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[discord] notify error', {
        ruleId: rule.id,
        triggerOn,
        ticketId: context.ticket.id,
        error: message,
      })
    }
  }
}