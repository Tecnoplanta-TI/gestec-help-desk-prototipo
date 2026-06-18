import { FormEvent, useEffect, useState } from 'react'
import { Clock, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import type { ServiceGroup, SlaRule, TicketPriority } from '../../../shared/types'
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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALL_VALUE = '__all__'

const PRIORITIES: TicketPriority[] = ['P1', 'P2', 'P3', 'P4']
const SERVICE_GROUPS: ServiceGroup[] = [
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
]

const SERVICE_GROUP_LABEL: Record<ServiceGroup, string> = {
  access_accounts: 'Acessos e contas',
  acquisitions: 'Aquisições',
  dashboards: 'Dashboards',
  emails: 'E-mails',
  gestec: 'Gestec',
  printers: 'Impressoras',
  maintenance_upgrade: 'Manutenção / upgrade',
  software: 'Software',
  network_internet: 'Rede / internet',
  erp: 'ERP',
  process_platform: 'Plataforma de processos',
  other: 'Outros',
}

function parseError(error: unknown): string {
  return getIpcErrorMessage(error, {
    overrides: { FORBIDDEN: 'Apenas administradores podem alterar regras de SLA.' },
    fallback: 'Não foi possível processar a operação.',
  })
}

export default function SlaPage(): JSX.Element {
  const currentUser = useAuthStore((s) => s.user)
  const [rules, setRules] = useState<SlaRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const [name, setName] = useState('')
  const [priority, setPriority] = useState<TicketPriority | ''>('')
  const [serviceGroup, setServiceGroup] = useState<ServiceGroup | ''>('')
  const [deadlineHours, setDeadlineHours] = useState<string>('24')

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)

  async function loadRules(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const result = await ipc.listSlaRules()
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

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setFeedback(null)

    const hours = Number(deadlineHours)
    if (!Number.isFinite(hours) || hours < 1) {
      setError('Informe um prazo válido (em horas, mínimo 1).')
      return
    }

    try {
      await ipc.createSlaRule({
        name: name.trim(),
        priority: priority || undefined,
        serviceGroup: serviceGroup || undefined,
        deadlineHours: hours,
      })
      setFeedback('Regra de SLA criada com sucesso.')
      setName('')
      setPriority('')
      setServiceGroup('')
      setDeadlineHours('24')
      setShowForm(false)
      await loadRules()
    } catch (err) {
      setError(parseError(err))
    }
  }

  async function handleDelete(ruleId: string): Promise<void> {
    setError(null)
    setFeedback(null)
    try {
      await ipc.deleteSlaRule(ruleId)
      setFeedback('Regra removida com sucesso.')
      await loadRules()
    } catch (err) {
      setError(parseError(err))
    }
  }

  async function handleSaveEdit(rule: SlaRule): Promise<void> {
    setError(null)
    setFeedback(null)

    const hours = Number(rule.deadlineHours)
    if (!Number.isFinite(hours) || hours < 1) {
      setError('Informe um prazo válido (em horas, mínimo 1).')
      return
    }

    try {
      await ipc.updateSlaRule({
        id: rule.id,
        name: rule.name,
        priority: rule.priority ?? null,
        serviceGroup: rule.serviceGroup ?? null,
        deadlineHours: hours,
      })
      setEditingRuleId(null)
      setFeedback('Regra atualizada com sucesso.')
      await loadRules()
    } catch (err) {
      setError(parseError(err))
    }
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="space-y-6">
        <PageHeader title="Regras de SLA" description="Configure prazos por prioridade e grupo de serviço." />
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito"
          description="Apenas administradores podem gerenciar regras de SLA."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regras de SLA"
        description="Configure prazos por prioridade e grupo de serviço."
      >
        <Button onClick={() => setShowForm((prev) => !prev)} className="gap-2">
          <Plus className="h-4 w-4" />
          {showForm ? 'Fechar formulário' : 'Nova regra'}
        </Button>
      </PageHeader>

      {error ? <StatusAlert variant="error" message={error} /> : null}
      {feedback ? <StatusAlert variant="success" message={feedback} /> : null}

      {showForm ? (
        <Card className="surface-card animate-in fade-in slide-in-from-top-1 duration-300">
          <CardHeader>
            <CardTitle className="text-lg">Nova regra</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label htmlFor="sla-name">Nome da regra</Label>
                <Input
                  id="sla-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Prioridade alta - Rede"
                  minLength={2}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sla-hours">Prazo (horas)</Label>
                <Input
                  id="sla-hours"
                  type="number"
                  value={deadlineHours}
                  onChange={(e) => setDeadlineHours(e.target.value)}
                  min={1}
                  step={1}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={priority || ALL_VALUE}
                  onValueChange={(value) =>
                    setPriority(value === ALL_VALUE ? '' : (value as TicketPriority))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>Todas as prioridades</SelectItem>
                    {PRIORITIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Grupo de serviço</Label>
                <Select
                  value={serviceGroup || ALL_VALUE}
                  onValueChange={(value) =>
                    setServiceGroup(value === ALL_VALUE ? '' : (value as ServiceGroup))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>Todos os grupos</SelectItem>
                    {SERVICE_GROUPS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {SERVICE_GROUP_LABEL[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit">Criar regra</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Regras cadastradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <InlineLoader rows={3} />
          ) : rules.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Nenhuma regra cadastrada"
              description="Crie a primeira regra de SLA para definir prazos automáticos."
            />
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className="rounded-lg border p-3">
                  {editingRuleId === rule.id ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nome</Label>
                        <Input
                          value={rule.name}
                          onChange={(e) =>
                            setRules((prev) =>
                              prev.map((item) =>
                                item.id === rule.id ? { ...item, name: e.target.value } : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Prazo (horas)</Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={rule.deadlineHours}
                          onChange={(e) =>
                            setRules((prev) =>
                              prev.map((item) =>
                                item.id === rule.id
                                  ? { ...item, deadlineHours: Number(e.target.value) }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Prioridade</Label>
                        <Select
                          value={rule.priority ?? ALL_VALUE}
                          onValueChange={(value) =>
                            setRules((prev) =>
                              prev.map((item) =>
                                item.id === rule.id
                                  ? {
                                      ...item,
                                      priority:
                                        value === ALL_VALUE ? undefined : (value as TicketPriority),
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_VALUE}>Todas as prioridades</SelectItem>
                            {PRIORITIES.map((item) => (
                              <SelectItem key={item} value={item}>
                                {item}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Grupo de serviço</Label>
                        <Select
                          value={rule.serviceGroup ?? ALL_VALUE}
                          onValueChange={(value) =>
                            setRules((prev) =>
                              prev.map((item) =>
                                item.id === rule.id
                                  ? {
                                      ...item,
                                      serviceGroup:
                                        value === ALL_VALUE ? undefined : (value as ServiceGroup),
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_VALUE}>Todos os grupos</SelectItem>
                            {SERVICE_GROUPS.map((item) => (
                              <SelectItem key={item} value={item}>
                                {SERVICE_GROUP_LABEL[item]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 md:col-span-2">
                        <Button size="sm" onClick={() => void handleSaveEdit(rule)}>
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingRuleId(null)
                            void loadRules()
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1.5">
                        <p className="text-sm font-medium">{rule.name}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {rule.priority ? `Prioridade ${rule.priority}` : 'Todas as prioridades'}
                          </Badge>
                          <Badge variant="outline">
                            {rule.serviceGroup
                              ? SERVICE_GROUP_LABEL[rule.serviceGroup]
                              : 'Todos os grupos'}
                          </Badge>
                          <Badge variant="secondary">{rule.deadlineHours}h</Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setEditingRuleId(rule.id)}
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
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
