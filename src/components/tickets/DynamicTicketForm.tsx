import { useEffect, useMemo, useState } from 'react'
import type {
  CostCenter,
  CreateTicketPayload,
  ServiceGroup,
  TicketPriority,
  TicketService,
  TicketType,
  UnavailableSystem,
  InoperableInfrastructure,
  User,
} from '../../../shared/types'
import { isFieldVisible, getRequiredFields } from '../../../shared/lib/form-rules'
import { sanitizeCreateTicketPayload } from '../../../shared/lib/ticket-payload'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ipc } from '@/lib/ipc'

const TYPES: TicketType[] = [
  'incident',
  'service_interruption',
  'improvement',
  'request',
  'cancellation',
]

const TYPE_LABEL: Record<TicketType, string> = {
  incident: 'Incidente',
  service_interruption: 'Interrupção de serviço',
  improvement: 'Melhoria',
  request: 'Solicitação',
  cancellation: 'Cancelamento Zeev',
}

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
  access_accounts: 'Acessos/Contas',
  acquisitions: 'Aquisição/Alocação',
  dashboards: 'Dashboard',
  emails: 'Email',
  gestec: 'Gestec',
  printers: 'Impressoras',
  maintenance_upgrade: 'Manutenção/Upgrade',
  software: 'Programas',
  network_internet: 'Rede/Internet',
  erp: 'SIGER',
  process_platform: 'Plataforma',
  other: 'Outro',
}

const SYSTEMS: UnavailableSystem[] = [
  '3cx',
  'ecommerce',
  'insoft',
  'kinghost',
  'other',
  'pdv_siger',
  'siger',
]

const INFRA: InoperableInfrastructure[] = [
  'internet',
  'other',
  'network',
  'time_clocks',
  'local_server',
  'ts',
  'vm',
  'vpn',
]

export interface DynamicTicketFormProps {
  initial?: Partial<CreateTicketPayload>
  currentUser?: User | null
  onSubmit: (payload: CreateTicketPayload) => Promise<void>
  onCancel?: () => void
  isSubmitting?: boolean
}

export function DynamicTicketForm({
  initial,
  currentUser,
  onSubmit,
  onCancel,
  isSubmitting,
}: DynamicTicketFormProps): JSX.Element {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState<CreateTicketPayload>({
    title: '',
    description: '',
    requesterName: currentUser?.name ?? '',
    requesterUserId: currentUser?.id,
    costCenter: '',
    type: 'request',
    priority: 'P3',
    serviceGroup: 'gestec',
    ...initial,
  })
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [cancelRows, setCancelRows] = useState([{ zeevRequestNumber: '', justification: '' }])

  useEffect(() => {
    void ipc.listCostCenters().then(setCostCenters).catch(() => undefined)
    void ipc.listUsers().then(setUsers).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!currentUser) return
    setForm((f) => ({
      ...f,
      requesterName: f.requesterName.trim() ? f.requesterName : currentUser.name,
      requesterUserId: f.requesterUserId ?? currentUser.id,
    }))
  }, [currentUser])

  const service = form.service

  const show = useMemo(
    () => (field: Parameters<typeof isFieldVisible>[0]) =>
      isFieldVisible(field, form.type, service),
    [form.type, service],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    if (!form.costCenter) {
      setFieldError('Selecione o centro de custo.')
      return
    }
    if (!form.requesterName.trim() || form.requesterName.trim().length < 2) {
      setFieldError('Informe o nome do solicitante (mínimo 2 caracteres).')
      return
    }
    if (form.type !== 'cancellation' && form.description.trim().length < 3) {
      setFieldError('A solicitação deve ter pelo menos 3 caracteres.')
      return
    }

    const required = getRequiredFields(form.type, form.service)
    if (required.has('service') && !form.service) {
      setFieldError('Selecione o tipo de serviço (Sistema ou Infraestrutura).')
      return
    }
    if (required.has('unavailableSystem') && !form.unavailableSystem) {
      setFieldError('Selecione o sistema indisponível.')
      return
    }
    if (required.has('inoperableInfrastructure') && !form.inoperableInfrastructure) {
      setFieldError('Selecione a infraestrutura inoperante.')
      return
    }
    if (required.has('improvementAcknowledged') && !form.improvementAcknowledged) {
      setFieldError('Confirme a ciência sobre o tipo Melhoria.')
      return
    }
    if (required.has('applicationProcess') && !form.applicationProcess?.trim()) {
      setFieldError('Informe o aplicativo ou processo.')
      return
    }
    if (required.has('appManagerId') && !form.appManagerId) {
      setFieldError('Selecione o gestor do aplicativo.')
      return
    }

    const payload = sanitizeCreateTicketPayload({
      ...form,
      requesterEmail: currentUser?.email,
      title: form.title || form.description.slice(0, 80),
      cancellationItems:
        form.type === 'cancellation'
          ? cancelRows.filter((r) => r.zeevRequestNumber.trim())
          : undefined,
    })
    await onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fieldError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {fieldError}
        </p>
      )}

      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Solicitante</p>
        <div className="space-y-2">
          <Label htmlFor="requester-name">
            Nome <span className="text-destructive">*</span>
          </Label>
          <Input
            id="requester-name"
            value={form.requesterName}
            onChange={(e) => setForm((f) => ({ ...f, requesterName: e.target.value }))}
            placeholder="Nome completo"
            autoComplete="name"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo solicitação *</Label>
          <Select
            value={form.type}
            onValueChange={(v) => setForm((f) => ({ ...f, type: v as TicketType }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Centro de custo *</Label>
          <Select
            value={form.costCenter}
            onValueChange={(v) => setForm((f) => ({ ...f, costCenter: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {costCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.code}>
                  {cc.code} — {cc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.type !== 'cancellation' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Prioridade *</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => setForm((f) => ({ ...f, priority: v as TicketPriority }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              P1 imediato · P2 4–8h · P3 1–3 dias · P4 3–5 dias
            </p>
          </div>
          <div className="space-y-2">
            <Label>Grupo de serviços *</Label>
            <Select
              value={form.serviceGroup}
              onValueChange={(v) => setForm((f) => ({ ...f, serviceGroup: v as ServiceGroup }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {SERVICE_GROUP_LABEL[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {show('service') && (
        <div className="space-y-2">
          <Label>Serviço *</Label>
          <Select
            value={form.service ?? ''}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, service: v as TicketService }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">Sistema</SelectItem>
              <SelectItem value="infrastructure">Infraestrutura</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {show('unavailableSystem') && (
        <div className="space-y-2">
          <Label>Sistema indisponível *</Label>
          <Select
            value={form.unavailableSystem ?? ''}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, unavailableSystem: v as UnavailableSystem }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {SYSTEMS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {show('inoperableInfrastructure') && (
        <div className="space-y-2">
          <Label>Infraestrutura inoperante *</Label>
          <Select
            value={form.inoperableInfrastructure ?? ''}
            onValueChange={(v) =>
              setForm((f) => ({
                ...f,
                inoperableInfrastructure: v as InoperableInfrastructure,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {INFRA.map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {show('downtimeMinutes') && (
        <div className="space-y-2">
          <Label>Tempo indisponibilidade (min) *</Label>
          <Input
            type="number"
            min={0}
            value={form.downtimeMinutes ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                downtimeMinutes: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
        </div>
      )}

      {show('improvementAcknowledged') && (
        <div className="flex items-start gap-2 rounded-md border p-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.improvementAcknowledged ?? false}
            onChange={(e) =>
              setForm((f) => ({ ...f, improvementAcknowledged: e.target.checked }))
            }
          />
          <p className="text-sm">
            Estou ciente que MELHORIA deve ser utilizado apenas para novas funcionalidades e não
            para suporte/incidente.
          </p>
        </div>
      )}

      {show('applicationProcess') && (
        <div className="space-y-2">
          <Label>Aplicativo / Processo *</Label>
          <Input
            value={form.applicationProcess ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, applicationProcess: e.target.value }))}
          />
        </div>
      )}

      {show('appManagerId') && (
        <div className="space-y-2">
          <Label>Gestor do app *</Label>
          <Select
            value={form.appManagerId ?? ''}
            onValueChange={(v) => setForm((f) => ({ ...f, appManagerId: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {show('cancellationItems') && (
        <div className="space-y-2">
          <Label>Solicitações a cancelar *</Label>
          {cancelRows.map((row, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Número da solicitação"
                value={row.zeevRequestNumber}
                onChange={(e) => {
                  const next = [...cancelRows]
                  next[idx] = { ...next[idx], zeevRequestNumber: e.target.value }
                  setCancelRows(next)
                }}
              />
              <Input
                placeholder="Justificativa"
                value={row.justification}
                onChange={(e) => {
                  const next = [...cancelRows]
                  next[idx] = { ...next[idx], justification: e.target.value }
                  setCancelRows(next)
                }}
              />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setCancelRows([...cancelRows, { zeevRequestNumber: '', justification: '' }])}>
            Adicionar linha
          </Button>
        </div>
      )}

      {form.type !== 'cancellation' && (
        <>
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Resumo curto (opcional)"
            />
          </div>
          <div className="space-y-2">
            <Label>Solicitação *</Label>
            <Textarea
              rows={5}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Descreva a solicitação ou problema em detalhes"
            />
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enviando…' : 'Abrir ticket'}
        </Button>
      </div>
    </form>
  )
}
