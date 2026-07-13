import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Play } from 'lucide-react'
import type { CostCenter, ServiceGroup, Ticket, TicketLevel, TicketPriority, User } from '../../../shared/types'
import { WORKFLOW_STEPS } from '../../../shared/lib/workflow-steps'
import { getTicketDisplayId } from '../../../shared/lib/ticket-public-id'
import { computeTicketBilling, formatCurrency } from '@/lib/ticket-billing'
import {
  LEVEL_LABEL,
  PRIORITY_LABEL,
  SERVICE_GROUP_LABEL,
  SERVICE_GROUPS,
  TICKET_LEVELS,
  TICKET_PRIORITIES,
  TICKET_TYPE_LABEL,
} from '@/lib/ticket-labels'
import { getIpcErrorMessage } from '@/lib/errors'
import { ipc } from '@/lib/ipc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { InlineLoader } from '@/components/shared/PageLoader'

interface TicketActionDialogProps {
  ticketId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged?: () => void | Promise<void>
}

function formatDateTime(iso?: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('pt-BR')
}

function userName(users: User[], id?: string): string {
  if (!id) return 'Nenhum'
  return users.find((user) => user.id === id)?.name ?? id
}

function getModalTitle(ticket: Ticket): string {
  if (ticket.status === WORKFLOW_STEPS.awaiting_service) {
    return `Contato inicial - ${getTicketDisplayId(ticket)}`
  }
  if (ticket.status === WORKFLOW_STEPS.in_service) {
    return `Atender solicitação - ${getTicketDisplayId(ticket)}`
  }
  return `Ticket - ${getTicketDisplayId(ticket)}`
}

export function TicketActionDialog({
  ticketId,
  open,
  onOpenChange,
  onChanged,
}: TicketActionDialogProps): JSX.Element {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [costCenter, setCostCenter] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('P3')
  const [level, setLevel] = useState<TicketLevel>('N1')
  const [serviceGroup, setServiceGroup] = useState<ServiceGroup>('gestec')
  const [serviceDueDate, setServiceDueDate] = useState('')
  const [additionalAssigneeId, setAdditionalAssigneeId] = useState('')

  const billing = useMemo(() => (ticket ? computeTicketBilling(ticket) : null), [ticket])
  const isAwaitingService = ticket?.status === WORKFLOW_STEPS.awaiting_service
  const isInService = ticket?.status === WORKFLOW_STEPS.in_service

  async function load(): Promise<void> {
    if (!ticketId) return
    setLoading(true)
    setError(null)
    try {
      const [ticketData, usersData, centers] = await Promise.all([
        ipc.getTicketById(ticketId),
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
    } catch (err) {
      setError(getIpcErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, ticketId])

  async function saveServiceFields(): Promise<void> {
    if (!ticket) return
    await ipc.updateServiceTicket({
      ticketId: ticket.id,
      costCenter,
      priority,
      level,
      serviceGroup,
      serviceDueDate,
      additionalAssigneeId: additionalAssigneeId || null,
    })
  }

  async function handleStartService(): Promise<void> {
    if (!ticket) return
    setBusy(true)
    setError(null)
    try {
      await saveServiceFields()
      const updated = await ipc.startTicketService(ticket.id)
      setTicket(updated)
      await onChanged?.()
    } catch (err) {
      setError(getIpcErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSendToApproval(): Promise<void> {
    if (!ticket) return
    setBusy(true)
    setError(null)
    try {
      await saveServiceFields()
      const updated = await ipc.completeTicketService({
        ticketId: ticket.id,
        resolutionSummary: ticket.supportNotes || 'Atendimento finalizado pelo modal de atendimento.',
      })
      setTicket(updated)
      await onChanged?.()
    } catch (err) {
      setError(getIpcErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] w-[min(94vw,1180px)] max-w-none overflow-y-auto rounded-2xl p-6 sm:p-8">
        {loading ? (
          <InlineLoader rows={8} />
        ) : ticket ? (
          <div className="space-y-5">
            <DialogHeader className="pr-10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <DialogTitle className="text-xl">{getModalTitle(ticket)}</DialogTitle>
                  <DialogDescription className="mt-2">{ticket.title}</DialogDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="gap-2 self-start">
                  <ArrowLeft className="h-4 w-4" />
                  Fila de atendimento
                </Button>
              </div>
            </DialogHeader>

            {error ? <StatusAlert variant="error" message={error} /> : null}

            {isAwaitingService ? (
              <StatusAlert
                variant="success"
                message="Revise os dados do ticket e clique em Iniciar contato inicial para registrar o primeiro atendimento."
              />
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Solicitante</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Data abertura</p>
                      <p>{formatDateTime(ticket.openedAt ?? ticket.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Solicitante</p>
                      <p>{ticket.requester.name}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Ticket</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Número ticket</Label>
                      <Input value={getTicketDisplayId(ticket)} readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo solicitação</Label>
                      <Input value={TICKET_TYPE_LABEL[ticket.type]} readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label>Centro de custo</Label>
                      <Select value={costCenter} onValueChange={setCostCenter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {costCenters.map((center) => (
                            <SelectItem key={center.id} value={center.code}>
                              {center.code} - {center.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Prioridade</Label>
                      <Select value={priority} onValueChange={(value) => setPriority(value as TicketPriority)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_PRIORITIES.map((item) => (
                            <SelectItem key={item} value={item}>
                              {PRIORITY_LABEL[item]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Nível</Label>
                      <Select value={level} onValueChange={(value) => setLevel(value as TicketLevel)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_LEVELS.map((item) => (
                            <SelectItem key={item} value={item}>
                              {LEVEL_LABEL[item]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Grupo de serviços</Label>
                      <Select value={serviceGroup} onValueChange={(value) => setServiceGroup(value as ServiceGroup)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_GROUPS.map((item) => (
                            <SelectItem key={item} value={item}>
                              {SERVICE_GROUP_LABEL[item]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Solicitação</Label>
                      <Input value={ticket.description || ticket.title} readOnly />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Responsável</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Responsável do atendimento</Label>
                      <Input value={userName(users, ticket.assigneeId)} readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label>Prazo do atendimento</Label>
                      <Input type="date" value={serviceDueDate} onChange={(event) => setServiceDueDate(event.target.value)} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Adicionar mais responsável?</Label>
                      <Select value={additionalAssigneeId || 'none'} onValueChange={(value) => setAdditionalAssigneeId(value === 'none' ? '' : value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {users.filter((user) => user.active).map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Adicione mais responsáveis para atender a solicitação.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4 lg:sticky lg:top-0 lg:self-start">
                {billing ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Cobrança</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Preço/hora (R$)</span>
                        <strong>{formatCurrency(billing.hourlyRate)}</strong>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Valor do atendimento (R$)</span>
                        <strong>{formatCurrency(billing.serviceValue)}</strong>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Custo com materiais (R$)</span>
                        <strong>{formatCurrency(billing.materialCost)}</strong>
                      </div>
                      <div className="flex justify-between gap-3 pt-2 font-semibold">
                        <span>Valor final do ticket (R$)</span>
                        <span>{formatCurrency(billing.finalValue)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                <Card className="border-emerald-100">
                  <CardHeader>
                    <CardTitle className="text-sm">Ações</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {isAwaitingService ? (
                      <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => void handleStartService()}>
                        <Play className="h-4 w-4" />
                        Iniciar contato inicial
                      </Button>
                    ) : null}
                    {isInService ? (
                      <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => void handleSendToApproval()}>
                        <CheckCircle2 className="h-4 w-4" />
                        Enviar para aprovação
                      </Button>
                    ) : null}
                    <Button asChild variant="outline" className="w-full">
                      <Link to={`/tickets/${ticket.id}`}>Ver detalhe completo</Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          <StatusAlert variant="error" message="Ticket não encontrado." />
        )}
      </DialogContent>
    </Dialog>
  )
}
