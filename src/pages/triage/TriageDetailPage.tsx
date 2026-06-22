import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ClipboardCheck } from 'lucide-react'
import type {
  CostCenter,
  ServiceGroup,
  Ticket,
  TicketLevel,
  TicketPriority,
  TicketType,
  User,
} from '../../../shared/types'
import { ZEEV_STEPS } from '../../../shared/lib/zeev-steps'
import { hasPermission } from '../../../shared/lib/permissions'
import {
  LEVEL_LABEL,
  PRIORITY_LABEL,
  SERVICE_GROUP_LABEL,
  SERVICE_GROUPS,
  TICKET_LEVELS,
  TICKET_PRIORITIES,
  TICKET_TYPE_LABEL,
  TICKET_TYPES,
} from '@/lib/ticket-labels'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { InfoRow } from '@/components/shared/InfoRow'
import { InlineLoader } from '@/components/shared/PageLoader'
import { PriorityCriteriaCard } from '@/components/tickets/PriorityCriteriaCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

interface ChecklistItemProps {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function ChecklistItem({ id, label, checked, onChange }: ChecklistItemProps): JSX.Element {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
        checked ? 'border-primary/30 bg-primary/5' : 'hover:bg-muted/50',
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
      />
      <span className="text-sm leading-snug">{label}</span>
    </label>
  )
}

export default function TriageDetailPage(): JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const currentUser = useAuthStore((state) => state.user)

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [checkCostCenter, setCheckCostCenter] = useState(false)
  const [checkClassification, setCheckClassification] = useState(false)

  const [costCenter, setCostCenter] = useState('')
  const [type, setType] = useState<TicketType>('request')
  const [priority, setPriority] = useState<TicketPriority>('P3')
  const [level, setLevel] = useState<TicketLevel>('N1')
  const [serviceGroup, setServiceGroup] = useState<ServiceGroup>('access_accounts')
  const [assigneeId, setAssigneeId] = useState('')
  const [justification, setJustification] = useState('')

  const agents = useMemo(
    () => users.filter((u) => u.active && hasPermission(u, 'agent')),
    [users],
  )

  const checklistComplete = checkCostCenter && checkClassification
  const canApprove = checklistComplete && Boolean(assigneeId) && !busy
  const canReject = Boolean(justification.trim()) && !busy

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        const [ticketData, usersData, centers] = await Promise.all([
          ipc.getTicketById(id),
          ipc.listUsers(),
          ipc.listCostCenters(),
        ])
        if (cancelled) return

        setTicket(ticketData)
        setUsers(usersData)
        setCostCenters(centers)
        setCostCenter(ticketData.requester.costCenter)
        setType(ticketData.type)
        setPriority(ticketData.priority)
        setLevel(ticketData.level ?? 'N1')
        setServiceGroup(ticketData.serviceGroup)
      } catch (e) {
        if (!cancelled) setError(getIpcErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (!currentUser || !hasPermission(currentUser, 'triage')) {
    return (
      <div className="space-y-4">
        <StatusAlert variant="error" message="Você não tem permissão para realizar triagem." />
        <Button variant="outline" asChild>
          <Link to="/triage">Voltar à fila</Link>
        </Button>
      </div>
    )
  }

  if (loading) return <InlineLoader />
  if (error || !ticket) {
    return (
      <div className="space-y-4">
        <StatusAlert variant="error" message={error ?? 'Ticket não encontrado.'} />
        <Button variant="outline" asChild>
          <Link to="/triage">Voltar à fila</Link>
        </Button>
      </div>
    )
  }

  if (ticket.status !== ZEEV_STEPS.in_triage) {
    return (
      <div className="space-y-4">
        <StatusAlert
          variant="error"
          message="Este ticket não está mais na etapa de triagem."
        />
        <Button variant="outline" asChild>
          <Link to={`/tickets/${ticket.id}`}>Ver detalhes do ticket</Link>
        </Button>
      </div>
    )
  }

  async function submit(decision: 'approve' | 'reject' | 'adjustment') {
    if (!ticket) return
    setBusy(true)
    try {
      const updated = await ipc.triageTicket({
        ticketId: ticket.id,
        decision,
        assigneeId: decision === 'approve' ? assigneeId : undefined,
        justification: justification.trim() || undefined,
        costCenter,
        type,
        priority,
        level,
        serviceGroup,
      })
      setTicket(updated)
      toast({
        title:
          decision === 'approve'
            ? 'Triagem aprovada'
            : decision === 'reject'
              ? 'Ticket recusado na triagem'
              : 'Ajuste solicitado ao solicitante',
      })
      navigate('/triage')
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível concluir a triagem',
        description: getIpcErrorMessage(e),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Triagem · ${ticket.ticketNumber ?? ticket.id.slice(0, 8)}`}
        description={ticket.title}
      >
        <Button variant="outline" size="sm" asChild>
          <Link to="/triage">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Fila de triagem
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="surface-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                Checklist
              </CardTitle>
              <CardDescription>
                Confirme os itens antes de aprovar e encaminhar para atendimento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ChecklistItem
                id="check-cc"
                label="Centro de custo correto"
                checked={checkCostCenter}
                onChange={setCheckCostCenter}
              />
              <ChecklistItem
                id="check-class"
                label="Classificação de tipo, grupo, prioridade e nível estão corretos"
                checked={checkClassification}
                onChange={setCheckClassification}
              />
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Solicitante</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <InfoRow label="Data abertura" value={formatDateTime(ticket.openedAt ?? ticket.createdAt)} />
                <InfoRow label="Solicitante" value={ticket.requester.name} />
              </dl>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ticket</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl>
                <InfoRow label="Número ticket" value={ticket.ticketNumber ?? '—'} />
              </dl>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    Centro de custo <span className="text-destructive">*</span>
                  </Label>
                  <Select value={costCenter} onValueChange={setCostCenter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {costCenters.map((cc) => (
                        <SelectItem key={cc.id} value={cc.code}>
                          {cc.code} — {cc.name}
                        </SelectItem>
                      ))}
                      {costCenter && !costCenters.some((cc) => cc.code === costCenter) && (
                        <SelectItem value={costCenter}>{costCenter}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    Tipo solicitação <span className="text-destructive">*</span>
                  </Label>
                  <Select value={type} onValueChange={(v) => setType(v as TicketType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TICKET_TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>
                    Prioridade <span className="text-destructive">*</span>
                  </Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PRIORITY_LABEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Este campo pode ser ajustado pelo atendente caso não esteja de acordo com os
                    critérios abaixo.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>
                    Nível <span className="text-destructive">*</span>
                  </Label>
                  <Select value={level} onValueChange={(v) => setLevel(v as TicketLevel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {LEVEL_LABEL[l]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    Grupo de serviços <span className="text-destructive">*</span>
                  </Label>
                  <Select value={serviceGroup} onValueChange={(v) => setServiceGroup(v as ServiceGroup)}>
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

              <Separator />

              <div className="space-y-2">
                <Label>Solicitação</Label>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                  {ticket.description || '—'}
                </div>
              </div>
            </CardContent>
          </Card>

          <PriorityCriteriaCard highlight={priority} defaultOpen={false} />
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="surface-card border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Responsável</CardTitle>
              <CardDescription>Defina o atendente e conclua a triagem.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Responsável do atendimento <span className="text-destructive">*</span>
                </Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Justificativa</Label>
                <Textarea
                  placeholder="Obrigatória para recusa; opcional para ajuste"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={4}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Button className="w-full" disabled={!canApprove} onClick={() => void submit('approve')}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Aprovar e encaminhar
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={!canReject}
                  onClick={() => void submit('reject')}
                >
                  Recusar
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={() => void submit('adjustment')}
                >
                  Solicitar ajuste ao solicitante
                </Button>
              </div>

              {!checklistComplete && (
                <p className="text-center text-xs text-muted-foreground">
                  Marque todos os itens do checklist para habilitar a aprovação.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
