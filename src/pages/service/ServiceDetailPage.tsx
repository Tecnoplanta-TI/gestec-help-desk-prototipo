import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, MessageSquare, Package, Pause, Play, Plus, SkipForward, Square, Timer, Trash2 } from 'lucide-react'
import type {
  Appointment,
  CostCenter,
  DeliveredEquipmentItem,
  ServiceGroup,
  Ticket,
  TicketLevel,
  TicketPriority,
  User,
} from '../../../shared/types'
import { formatDuration } from '../../../shared/lib/time'
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
} from '@/lib/ticket-labels'
import { computeTicketBilling, formatCurrency } from '@/lib/ticket-billing'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { formatSeconds, getTimerTotalSeconds } from '@/lib/timer'
import { useAuthStore } from '@/stores/authStore'
import { useTimerStore } from '@/stores/timerStore'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { InfoRow } from '@/components/shared/InfoRow'
import { InlineLoader } from '@/components/shared/PageLoader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

function formatDateBr(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function userName(users: User[], id?: string): string {
  if (!id) return '—'
  return users.find((u) => u.id === id)?.name ?? id.slice(0, 8)
}

export default function ServiceDetailPage(): JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const currentUser = useAuthStore((state) => state.user)
  const timers = useTimerStore((state) => state.timers)
  const setTimers = useTimerStore((state) => state.setTimers)

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [isTimerLoading, setIsTimerLoading] = useState(false)

  const [costCenter, setCostCenter] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('P3')
  const [level, setLevel] = useState<TicketLevel>('N1')
  const [serviceGroup, setServiceGroup] = useState<ServiceGroup>('access_accounts')
  const [serviceDueDate, setServiceDueDate] = useState('')
  const [additionalAssigneeId, setAdditionalAssigneeId] = useState('')
  const [equipment, setEquipment] = useState<DeliveredEquipmentItem[]>([])
  const [message, setMessage] = useState('')

  const [apptDate, setApptDate] = useState(todayIsoDate())
  const [apptTechnicianId, setApptTechnicianId] = useState('')
  const [apptStart, setApptStart] = useState('09:00')
  const [apptEnd, setApptEnd] = useState('10:00')
  const [apptNote, setApptNote] = useState('')

  const [createZeevUser, setCreateZeevUser] = useState(false)
  const [createEmail, setCreateEmail] = useState(false)
  const [facilitatorChecklist, setFacilitatorChecklist] = useState('')
  const [securitySealChanged, setSecuritySealChanged] = useState(false)
  const [securitySealCode, setSecuritySealCode] = useState('')
  const [newSecuritySealCode, setNewSecuritySealCode] = useState('')
  const [expenseDesc, setExpenseDesc] = useState('')
  const [expenseQty, setExpenseQty] = useState('1')
  const [expenseCost, setExpenseCost] = useState('0')

  const showFacilitator = serviceGroup === 'access_accounts'

  const isInService = ticket?.status === ZEEV_STEPS.in_service
  const isAwaiting = ticket?.status === ZEEV_STEPS.awaiting_service
  const canEdit = isInService

  const agents = useMemo(
    () => users.filter((u) => u.active && hasPermission(u, 'agent')),
    [users],
  )

  const billing = useMemo(
    () => (ticket ? computeTicketBilling(ticket) : null),
    [ticket],
  )

  const completionBlockers = useMemo(() => {
    const items: string[] = []
    if (!serviceDueDate) items.push('Informe o prazo do atendimento (seção Responsável)')
    return items
  }, [serviceDueDate])

  const canComplete = completionBlockers.length === 0

  const currentTicketTimer = useMemo(() => {
    if (!ticket) return null
    return (
      timers.find((timer) => timer.entityType === 'ticket' && timer.entityId === ticket.id) ?? null
    )
  }, [timers, ticket])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [ticketData, usersData, centers] = await Promise.all([
        ipc.getTicketById(id),
        ipc.listUsers(),
        ipc.listCostCenters(),
      ])
      setTicket(ticketData)
      setUsers(usersData)
      setCostCenters(centers)
      setCostCenter(ticketData.requester.costCenter)
      setPriority(ticketData.priority)
      setLevel(ticketData.level ?? 'N1')
      setServiceGroup(ticketData.serviceGroup)
      setServiceDueDate(ticketData.serviceDueDate ?? '')
      setAdditionalAssigneeId(ticketData.additionalAssigneeId ?? '')
      setEquipment(ticketData.deliveredEquipment ?? [])
      setApptTechnicianId(ticketData.assigneeId ?? '')
      setCreateZeevUser(ticketData.createZeevUser ?? false)
      setCreateEmail(ticketData.createEmail ?? false)
      setFacilitatorChecklist(ticketData.facilitatorChecklist ?? '')
      setSecuritySealChanged(ticketData.securitySealChanged ?? false)
      setSecuritySealCode(ticketData.securitySealCode ?? '')
      setNewSecuritySealCode(ticketData.newSecuritySealCode ?? '')
    } catch (e) {
      setError(getIpcErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function persistServiceFields(): Promise<Ticket | null> {
    if (!ticket || !canEdit) return ticket
    try {
      const updated = await ipc.updateServiceTicket({
        ticketId: ticket.id,
        costCenter,
        priority,
        level,
        serviceGroup,
        serviceDueDate: serviceDueDate || undefined,
        additionalAssigneeId: additionalAssigneeId || null,
        deliveredEquipment: equipment,
        createZeevUser,
        createEmail,
        facilitatorChecklist: facilitatorChecklist || undefined,
        securitySealChanged,
        securitySealCode: securitySealCode || undefined,
        newSecuritySealCode: newSecuritySealCode || undefined,
      })
      setTicket(updated)
      return updated
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: getIpcErrorMessage(e),
      })
      return null
    }
  }

  async function handleAddExpense(): Promise<void> {
    if (!ticket || !expenseDesc.trim()) return
    const quantity = Number(expenseQty)
    const unitValue = Number(expenseCost)
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitValue)) return
    setBusy(true)
    try {
      const updated = await ipc.createEntityExpense({
        entityType: 'ticket',
        entityId: ticket.id,
        description: expenseDesc.trim(),
        quantity,
        unitValue,
      })
      setTicket(updated as Ticket)
      setExpenseDesc('')
      setExpenseQty('1')
      setExpenseCost('0')
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro ao lançar custo',
        description: getIpcErrorMessage(e),
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteExpense(expenseId: string): Promise<void> {
    if (!ticket) return
    setBusy(true)
    try {
      const updated = await ipc.deleteEntityExpense({
        entityType: 'ticket',
        entityId: ticket.id,
        expenseId,
      })
      setTicket(updated as Ticket)
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: getIpcErrorMessage(e),
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleStartService(): Promise<void> {
    if (!ticket) return
    setBusy(true)
    try {
      const updated = await ipc.startTicketService(ticket.id)
      setTicket(updated)
      toast({ title: 'Contato inicial concluído' })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível concluir',
        description: getIpcErrorMessage(e),
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleSkipInitialContact(): Promise<void> {
    if (!ticket) return
    setBusy(true)
    try {
      const updated = await ipc.skipTicketInitialContact(ticket.id)
      setTicket(updated)
      toast({ title: 'Contato inicial ignorado' })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível pular',
        description: getIpcErrorMessage(e),
      })
    } finally {
      setBusy(false)
    }
  }

  async function refreshTimers(): Promise<void> {
    const active = await ipc.getActiveTimers()
    setTimers(active)
  }

  async function handleStartOrResumeTimer(): Promise<void> {
    if (!ticket) return
    setIsTimerLoading(true)
    try {
      await ipc.startTimer(ticket.id, 'ticket', ticket.title)
      await refreshTimers()
      toast({ title: 'Cronômetro iniciado' })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível iniciar o cronômetro',
        description: getIpcErrorMessage(e),
      })
    } finally {
      setIsTimerLoading(false)
    }
  }

  async function handlePauseTimer(): Promise<void> {
    if (!currentTicketTimer) return
    setIsTimerLoading(true)
    try {
      await ipc.pauseTimer(currentTicketTimer.id)
      await refreshTimers()
      toast({ title: 'Cronômetro pausado' })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível pausar',
        description: getIpcErrorMessage(e),
      })
    } finally {
      setIsTimerLoading(false)
    }
  }

  async function handleStopTimer(): Promise<void> {
    if (!ticket || !currentTicketTimer) return
    setIsTimerLoading(true)
    try {
      await ipc.stopTimer(currentTicketTimer.id)
      await refreshTimers()
      const updatedTicket = await ipc.getTicketById(ticket.id)
      setTicket(updatedTicket)
      toast({ title: 'Cronômetro parado e apontamento registrado' })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível parar',
        description: getIpcErrorMessage(e),
      })
    } finally {
      setIsTimerLoading(false)
    }
  }

  async function handleComplete(): Promise<void> {
    if (!ticket) return
    if (!serviceDueDate) {
      toast({
        variant: 'destructive',
        title: 'Prazo obrigatório',
        description: 'Informe o prazo do atendimento.',
      })
      return
    }
    setBusy(true)
    try {
      await ipc.updateServiceTicket({
        ticketId: ticket.id,
        costCenter,
        priority,
        level,
        serviceGroup,
        serviceDueDate: serviceDueDate || undefined,
        additionalAssigneeId: additionalAssigneeId || null,
        deliveredEquipment: equipment,
        createZeevUser,
        createEmail,
        facilitatorChecklist: facilitatorChecklist || undefined,
        securitySealChanged,
        securitySealCode: securitySealCode || undefined,
        newSecuritySealCode: newSecuritySealCode || undefined,
      })
      await ipc.completeTicketService({
        ticketId: ticket.id,
        deliveredEquipment: equipment,
      })
      toast({ title: 'Enviado para aprovação de conclusão' })
      navigate('/service')
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível concluir',
        description: getIpcErrorMessage(e),
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleAddAppointment(): Promise<void> {
    if (!ticket || !canEdit) return
    setBusy(true)
    try {
      const updated = await ipc.createTicketAppointment({
        ticketId: ticket.id,
        date: apptDate,
        startTime: apptStart,
        endTime: apptEnd,
        note: apptNote.trim() || undefined,
        technicianId: apptTechnicianId || undefined,
      })
      setTicket(updated)
      setApptNote('')
      toast({ title: 'Apontamento registrado' })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Apontamento inválido',
        description: getIpcErrorMessage(e),
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteAppointment(appointmentId: string): Promise<void> {
    if (!ticket || !canEdit) return
    setBusy(true)
    try {
      const updated = await ipc.deleteTicketAppointment({
        ticketId: ticket.id,
        appointmentId,
      })
      setTicket(updated)
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: getIpcErrorMessage(e),
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleSendMessage(): Promise<void> {
    if (!ticket || !message.trim() || !canEdit) return
    setBusy(true)
    try {
      const updated = await ipc.addTicketComment({
        ticketId: ticket.id,
        body: message.trim(),
        isInternal: false,
      })
      setTicket(updated)
      setMessage('')
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar mensagem',
        description: getIpcErrorMessage(e),
      })
    } finally {
      setBusy(false)
    }
  }

  if (!currentUser || !hasPermission(currentUser, 'agent')) {
    return (
      <div className="space-y-4">
        <StatusAlert variant="error" message="Você não tem permissão para atender tickets." />
        <Button variant="outline" asChild>
          <Link to="/service">Voltar à fila</Link>
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
          <Link to="/service">Voltar à fila</Link>
        </Button>
      </div>
    )
  }

  const isServicePhase = isAwaiting || isInService
  if (!isServicePhase) {
    return (
      <div className="space-y-4">
        <StatusAlert variant="error" message="Este ticket não está na etapa de atendimento." />
        <Button variant="outline" asChild>
          <Link to={`/tickets/${ticket.id}`}>Ver detalhes do ticket</Link>
        </Button>
      </div>
    )
  }

  const assigneeName = userName(users, ticket.assigneeId)

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          isAwaiting
            ? `Contato inicial · ${ticket.ticketNumber ?? ticket.id.slice(0, 8)}`
            : `Atender solicitação · ${ticket.ticketNumber ?? ticket.id.slice(0, 8)}`
        }
        description={ticket.title}
      >
        <Button variant="outline" size="sm" asChild>
          <Link to="/service">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Fila de atendimento
          </Link>
        </Button>
      </PageHeader>

      {isAwaiting && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          Revise os dados do ticket e clique em <strong>Concluir</strong> para registrar o contato
          inicial, ou em <strong>Pular</strong> se não for necessário.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Solicitante</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <InfoRow
                  label="Data abertura"
                  value={formatDateTime(ticket.openedAt ?? ticket.createdAt)}
                />
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
                  <Select
                    value={costCenter}
                    onValueChange={setCostCenter}
                    disabled={!canEdit}
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
                <div className="space-y-2">
                  <Label>Tipo solicitação</Label>
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    {TICKET_TYPE_LABEL[ticket.type]}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>
                    Prioridade <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={priority}
                    onValueChange={(v) => setPriority(v as TicketPriority)}
                    disabled={!canEdit}
                  >
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
                </div>
                <div className="space-y-2">
                  <Label>
                    Nível <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={level}
                    onValueChange={(v) => setLevel(v as TicketLevel)}
                    disabled={!canEdit}
                  >
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
                <div className="space-y-2 sm:col-span-2">
                  <Label>
                    Grupo de serviços <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={serviceGroup}
                    onValueChange={(v) => setServiceGroup(v as ServiceGroup)}
                    disabled={!canEdit}
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
              <Separator />
              <div className="space-y-2">
                <Label>Solicitação</Label>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                  {ticket.description || '—'}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Responsável</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Responsável do atendimento</Label>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
                  {assigneeName}
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  Prazo do atendimento <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={serviceDueDate}
                  onChange={(e) => setServiceDueDate(e.target.value)}
                  onBlur={() => void persistServiceFields()}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Adicionar mais responsável?</Label>
                <Select
                  value={additionalAssigneeId || '__none__'}
                  onValueChange={(v) => setAdditionalAssigneeId(v === '__none__' ? '' : v)}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {agents
                      .filter((u) => u.id !== ticket.assigneeId)
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Adicione mais responsáveis para atender a solicitação.
                </p>
              </div>
            </CardContent>
          </Card>

          {isInService && showFacilitator && (
            <Card className="surface-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Facilitador</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Criar usuário no Zeev?</Label>
                  <Select
                    value={createZeevUser ? 'yes' : 'no'}
                    onValueChange={(v) => {
                      setCreateZeevUser(v === 'yes')
                      void persistServiceFields()
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">Não</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Criar e-mail?</Label>
                  <Select
                    value={createEmail ? 'yes' : 'no'}
                    onValueChange={(v) => {
                      setCreateEmail(v === 'yes')
                      void persistServiceFields()
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">Não</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Realizar checklist?</Label>
                  <Select
                    value={facilitatorChecklist || '__none__'}
                    onValueChange={(v) => {
                      setFacilitatorChecklist(v === '__none__' ? '' : v)
                      void persistServiceFields()
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Selecione</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {isInService && (
            <Card className="surface-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Lacre de segurança</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>
                    Houve troca do lacre? <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={securitySealChanged ? 'yes' : 'no'}
                    onValueChange={(v) => {
                      setSecuritySealChanged(v === 'yes')
                      void persistServiceFields()
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">Não</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {securitySealChanged && (
                  <>
                    <div className="space-y-2">
                      <Label>Código anterior</Label>
                      <Input
                        value={securitySealCode}
                        onChange={(e) => setSecuritySealCode(e.target.value)}
                        onBlur={() => void persistServiceFields()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Novo código</Label>
                      <Input
                        value={newSecuritySealCode}
                        onChange={(e) => setNewSecuritySealCode(e.target.value)}
                        onBlur={() => void persistServiceFields()}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {isInService && (
            <>
              <Card className="surface-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Apontamentos
                  </CardTitle>
                  <CardDescription>Registre o tempo dedicado ao atendimento.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Responsável</Label>
                      <Select value={apptTechnicianId} onValueChange={setApptTechnicianId}>
                        <SelectTrigger className="h-9">
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
                    <div className="space-y-1">
                      <Label className="text-xs">Data</Label>
                      <Input
                        type="date"
                        className="h-9"
                        value={apptDate}
                        onChange={(e) => setApptDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Hora início</Label>
                      <Input
                        type="time"
                        className="h-9"
                        value={apptStart}
                        onChange={(e) => setApptStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Hora fim</Label>
                      <Input
                        type="time"
                        className="h-9"
                        value={apptEnd}
                        onChange={(e) => setApptEnd(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Descrição apontamento</Label>
                      <Textarea
                        rows={2}
                        value={apptNote}
                        onChange={(e) => setApptNote(e.target.value)}
                        placeholder="O que foi feito neste período"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        size="sm"
                        className="w-full"
                        disabled={busy}
                        onClick={() => void handleAddAppointment()}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Inserir
                      </Button>
                    </div>
                  </div>

                  {(ticket.appointments ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum apontamento registrado.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10" />
                          <TableHead>Responsável</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Início</TableHead>
                          <TableHead>Fim</TableHead>
                          <TableHead>Duração</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(ticket.appointments ?? []).map((appt: Appointment) => (
                          <TableRow key={appt.id}>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                disabled={busy}
                                onClick={() => void handleDeleteAppointment(appt.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                            <TableCell className="text-sm">
                              {userName(users, appt.technicianId)}
                            </TableCell>
                            <TableCell className="text-sm">{formatDateBr(appt.date)}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm">
                              {appt.note ?? '—'}
                            </TableCell>
                            <TableCell className="text-sm">{appt.startTime}</TableCell>
                            <TableCell className="text-sm">{appt.endTime}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDuration(appt.totalMinutes)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card className="surface-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tabela de cobrança</CardTitle>
                  <CardDescription>Materiais e serviços utilizados no atendimento.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-4">
                    <Input
                      className="sm:col-span-2"
                      placeholder="Material/serviço"
                      value={expenseDesc}
                      onChange={(e) => setExpenseDesc(e.target.value)}
                    />
                    <Input
                      type="number"
                      min={1}
                      placeholder="Qtd"
                      value={expenseQty}
                      onChange={(e) => setExpenseQty(e.target.value)}
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Custo unit."
                      value={expenseCost}
                      onChange={(e) => setExpenseCost(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || !expenseDesc.trim()}
                    onClick={() => void handleAddExpense()}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Inserir
                  </Button>
                  {(ticket.expenses ?? []).length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10" />
                          <TableHead>Material/serviço</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead>Custo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(ticket.expenses ?? []).map((exp) => (
                          <TableRow key={exp.id}>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => void handleDeleteExpense(exp.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                            <TableCell>{exp.description}</TableCell>
                            <TableCell>{exp.quantity}</TableCell>
                            <TableCell>{formatCurrency(exp.totalValue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card className="surface-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Equipamentos entregues
                  </CardTitle>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link to={`/service/${ticket.id}/equipment`}>
                      Gerenciar
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {equipment.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum equipamento registrado.</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {equipment.length} {equipment.length === 1 ? 'item registrado' : 'itens registrados'}.
                      {' '}
                      <Link to={`/service/${ticket.id}/equipment`} className="text-primary hover:underline">
                        Ver tela completa
                      </Link>
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="surface-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    Mensagens
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(ticket.comments ?? []).length > 0 && (
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                      {(ticket.comments ?? []).map((c) => (
                        <div key={c.id} className="text-sm">
                          <span className="font-medium">{userName(users, c.authorId)}</span>
                          <span className="mx-2 text-xs text-muted-foreground">
                            {formatDateTime(c.createdAt)}
                          </span>
                          <p className="mt-0.5 text-muted-foreground">{c.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Digite uma mensagem..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          void handleSendMessage()
                        }
                      }}
                    />
                    <Button type="button" disabled={busy || !message.trim()} onClick={() => void handleSendMessage()}>
                      Enviar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
          {isInService && (
            <Card className="surface-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  Cronômetro
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!currentTicketTimer ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Nenhum cronômetro ativo.</p>
                    <Button
                      className="w-full gap-2"
                      disabled={isTimerLoading || busy}
                      onClick={() => void handleStartOrResumeTimer()}
                    >
                      <Play className="h-4 w-4" />
                      {isTimerLoading ? 'Processando...' : 'Iniciar cronômetro'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-muted/30 p-4 text-center">
                      <p className="font-mono text-3xl font-semibold tracking-tight">
                        {formatSeconds(getTimerTotalSeconds(currentTicketTimer))}
                      </p>
                      <Badge
                        variant={currentTicketTimer.state === 'running' ? 'default' : 'secondary'}
                        className="mt-2"
                      >
                        {currentTicketTimer.state === 'running' ? 'Em andamento' : 'Pausado'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {currentTicketTimer.state === 'running' ? (
                        <Button
                          variant="outline"
                          disabled={isTimerLoading || busy}
                          onClick={() => void handlePauseTimer()}
                          className="gap-2"
                        >
                          <Pause className="h-4 w-4" />
                          Pausar
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          disabled={isTimerLoading || busy}
                          onClick={() => void handleStartOrResumeTimer()}
                          className="gap-2"
                        >
                          <Play className="h-4 w-4" />
                          Retomar
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        disabled={isTimerLoading || busy}
                        onClick={() => void handleStopTimer()}
                        className="gap-2"
                      >
                        <Square className="h-4 w-4" />
                        Parar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {billing && isInService && (
            <Card className="surface-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cobrança</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço/hora (R$)</span>
                  <span>{formatCurrency(billing.hourlyRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor do atendimento (R$)</span>
                  <span>{formatCurrency(billing.serviceValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Custo com materiais (R$)</span>
                  <span>{formatCurrency(billing.materialCost)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Valor final do ticket (R$)</span>
                  <span>{formatCurrency(billing.finalValue)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="surface-card border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isAwaiting && (
                <>
                  <Button className="w-full" disabled={busy} onClick={() => void handleStartService()}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Concluir
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    onClick={() => void handleSkipInitialContact()}
                  >
                    <SkipForward className="mr-2 h-4 w-4" />
                    Pular
                  </Button>
                </>
              )}
              {isInService && (
                <Button
                  className="w-full"
                  disabled={busy || !canComplete}
                  onClick={() => void handleComplete()}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Enviar para aprovação
                </Button>
              )}
              <Button variant="outline" className="w-full" asChild>
                <Link to={`/tickets/${ticket.id}`}>Ver detalhe completo</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
