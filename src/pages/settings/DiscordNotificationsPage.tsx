import { FormEvent, useEffect, useState } from 'react'
import { Bell, Pencil, Plus, ShieldAlert, Trash2, X } from 'lucide-react'
import type {
  DiscordCondition,
  DiscordNotificationRule,
  DiscordTriggerEvent,
} from '../../../shared/types'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { EmptyState } from '@/components/shared/EmptyState'
import { InlineLoader } from '@/components/shared/PageLoader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ConditionForm = {
  id: string
  field: string
  operator: DiscordCondition['operator']
  value: string
}

const TRIGGERS: DiscordTriggerEvent[] = [
  'ticket_created',
  'ticket_status_changed',
  'ticket_assigned',
  'ticket_sla_warning',
  'ticket_sla_overdue',
  'ticket_closed',
]

const TRIGGER_LABEL: Record<DiscordTriggerEvent, string> = {
  ticket_created: 'Ticket criado',
  ticket_status_changed: 'Status alterado',
  ticket_assigned: 'Ticket atribuído',
  ticket_sla_warning: 'SLA próximo do prazo',
  ticket_sla_overdue: 'SLA estourado',
  ticket_closed: 'Ticket encerrado',
}

const CONDITION_FIELDS = [
  'ticket.priority',
  'ticket.serviceGroup',
  'ticket.type',
  'ticket.status',
  'requester.costCenter',
  'assignee.id',
]

const OPERATOR_LABEL: Record<DiscordCondition['operator'], string> = {
  equal: 'igual a',
  not_equal: 'diferente de',
  in: 'está na lista',
  contains: 'contém',
}

function createLocalId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function parseError(error: unknown): string {
  return getIpcErrorMessage(error, {
    overrides: {
      FORBIDDEN: 'Apenas administradores podem alterar regras de Discord.',
      INVALID_INPUT: 'Dados inválidos. Revise webhook, condições e template.',
      DISCORD_RULE_NOT_FOUND: 'Regra não encontrada.',
    },
    fallback: 'Não foi possível concluir a operação.',
  })
}

function mapConditionsToPayload(conditions: ConditionForm[]): DiscordCondition[] {
  return conditions
    .filter((condition) => condition.field.trim() && condition.value.trim())
    .map((condition) => {
      const normalizedValue = condition.value.trim()
      const parsedValue =
        condition.operator === 'in'
          ? normalizedValue
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : normalizedValue
      return {
        field: condition.field.trim(),
        operator: condition.operator,
        value: parsedValue,
      }
    })
}

function mapRuleToConditionForm(rule: DiscordNotificationRule): ConditionForm[] {
  return rule.conditions.map((condition) => ({
    id: createLocalId(),
    field: condition.field,
    operator: condition.operator,
    value: Array.isArray(condition.value) ? condition.value.join(', ') : condition.value,
  }))
}

export default function DiscordNotificationsPage(): JSX.Element {
  const currentUser = useAuthStore((state) => state.user)

  const [rules, setRules] = useState<DiscordNotificationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [triggerOn, setTriggerOn] = useState<DiscordTriggerEvent>('ticket_created')
  const [messageTemplate, setMessageTemplate] = useState('')
  const [active, setActive] = useState(true)
  const [conditions, setConditions] = useState<ConditionForm[]>([])

  async function loadRules(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const result = await ipc.listDiscordRules()
      setRules(result)
    } catch (err) {
      setError(parseError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRules()
  }, [])

  function resetForm(): void {
    setEditingRuleId(null)
    setName('')
    setWebhookUrl('')
    setTriggerOn('ticket_created')
    setMessageTemplate('')
    setActive(true)
    setConditions([])
  }

  function fillFormFromRule(rule: DiscordNotificationRule): void {
    setEditingRuleId(rule.id)
    setName(rule.name)
    setWebhookUrl(rule.webhookUrl)
    setTriggerOn(rule.triggerOn)
    setMessageTemplate(rule.messageTemplate)
    setActive(rule.active)
    setConditions(mapRuleToConditionForm(rule))
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setFeedback(null)

    const payload = {
      name: name.trim(),
      webhookUrl: webhookUrl.trim(),
      triggerOn,
      conditions: mapConditionsToPayload(conditions),
      messageTemplate: messageTemplate.trim(),
      active,
    }

    try {
      if (editingRuleId) {
        await ipc.updateDiscordRule({ id: editingRuleId, ...payload })
        setFeedback('Regra atualizada com sucesso.')
      } else {
        await ipc.createDiscordRule(payload)
        setFeedback('Regra criada com sucesso.')
      }
      resetForm()
      await loadRules()
    } catch (err) {
      setError(parseError(err))
    }
  }

  async function handleDelete(ruleId: string): Promise<void> {
    setError(null)
    setFeedback(null)
    try {
      await ipc.deleteDiscordRule(ruleId)
      if (editingRuleId === ruleId) {
        resetForm()
      }
      setFeedback('Regra removida com sucesso.')
      await loadRules()
    } catch (err) {
      setError(parseError(err))
    }
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Notificações Discord"
          description="Configure regras por evento, condições e template de mensagem."
        />
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito"
          description="Apenas administradores podem gerenciar regras de notificação."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificações Discord"
        description="Configure regras por evento, condições e template de mensagem."
      />

      {error ? <StatusAlert variant="error" message={error} /> : null}
      {feedback ? <StatusAlert variant="success" message={feedback} /> : null}

      <Card className="surface-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-4 w-4 text-muted-foreground" />
            {editingRuleId ? 'Editar regra' : 'Nova regra'}
          </CardTitle>
          {editingRuleId ? (
            <Button variant="outline" size="sm" onClick={resetForm}>
              Cancelar edição
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="d-name">Nome da regra</Label>
                <Input
                  id="d-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Alerta de SLA crítico"
                  minLength={2}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Evento</Label>
                <Select
                  value={triggerOn}
                  onValueChange={(value) => setTriggerOn(value as DiscordTriggerEvent)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((trigger) => (
                      <SelectItem key={trigger} value={trigger}>
                        {TRIGGER_LABEL[trigger]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="d-webhook">Webhook URL</Label>
              <Input
                id="d-webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="d-template">Mensagem</Label>
              <Textarea
                id="d-template"
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Ex.: Ticket {ticket.publicId} - {ticket.priority}"
                className="min-h-24"
                required
              />
              <p className="text-xs text-muted-foreground">
                Use variáveis como {'{ticket.publicId}'}, {'{ticket.priority}'} ou {'{requester.name}'}.
              </p>
            </div>

            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Regra ativa
            </label>

            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium">Condições</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    setConditions((prev) => [
                      ...prev,
                      { id: createLocalId(), field: 'ticket.priority', operator: 'equal', value: '' },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar condição
                </Button>
              </div>

              {conditions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sem condições: dispara para qualquer ticket no evento.
                </p>
              ) : (
                <div className="space-y-2">
                  {conditions.map((condition) => (
                    <div
                      key={condition.id}
                      className="grid items-end gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"
                    >
                      <Select
                        value={condition.field}
                        onValueChange={(value) =>
                          setConditions((prev) =>
                            prev.map((item) =>
                              item.id === condition.id ? { ...item, field: value } : item,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITION_FIELDS.map((field) => (
                            <SelectItem key={field} value={field}>
                              {field}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={condition.operator}
                        onValueChange={(value) =>
                          setConditions((prev) =>
                            prev.map((item) =>
                              item.id === condition.id
                                ? { ...item, operator: value as DiscordCondition['operator'] }
                                : item,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(OPERATOR_LABEL) as DiscordCondition['operator'][]).map(
                            (operator) => (
                              <SelectItem key={operator} value={operator}>
                                {OPERATOR_LABEL[operator]}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>

                      <Input
                        value={condition.value}
                        onChange={(e) =>
                          setConditions((prev) =>
                            prev.map((item) =>
                              item.id === condition.id ? { ...item, value: e.target.value } : item,
                            ),
                          )
                        }
                        placeholder="Valor (use vírgula para listas)"
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover condição"
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                          setConditions((prev) => prev.filter((item) => item.id !== condition.id))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit">{editingRuleId ? 'Salvar regra' : 'Criar regra'}</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-base">Regras cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <InlineLoader rows={3} />
          ) : rules.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Nenhuma regra cadastrada"
              description="Crie uma regra para enviar notificações ao Discord."
            />
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{rule.name}</p>
                        <Badge variant={rule.active ? 'default' : 'secondary'}>
                          {rule.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                        <Badge variant="outline">{TRIGGER_LABEL[rule.triggerOn]}</Badge>
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {rule.messageTemplate}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => fillFormFromRule(rule)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Excluir regra"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void handleDelete(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
