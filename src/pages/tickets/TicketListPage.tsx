import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, Ticket as TicketIcon } from 'lucide-react'
import type { CreateTicketPayload, Ticket, TicketPriority, TicketListScope, Workflow } from '../../../shared/types'
import { TICKET_LIST_SCOPE_LABELS } from '../../../shared/lib/ticket-access'
import { WORKFLOW_STEP_LABELS } from '../../../shared/lib/workflow-steps'
import { getTicketDisplayId } from '../../../shared/lib/ticket-public-id'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/authStore'
import { sanitizeCreateTicketPayload } from '../../../shared/lib/ticket-payload'
import { DynamicTicketForm } from '@/components/tickets/DynamicTicketForm'
import { TicketActionDialog } from '@/components/tickets/TicketActionDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { EmptyState } from '@/components/shared/EmptyState'
import { InlineLoader } from '@/components/shared/PageLoader'
import { SlaIndicator } from '@/components/tickets/SlaIndicator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PRIORITIES: TicketPriority[] = ['P1', 'P2', 'P3', 'P4']

const PRIORITY_VARIANT: Record<TicketPriority, 'destructive' | 'default' | 'secondary' | 'outline'> = {
  P1: 'destructive',
  P2: 'default',
  P3: 'secondary',
  P4: 'outline',
}

const SCOPES: TicketListScope[] = ['accessible', 'mine', 'participated']

function getErrorMessage(error: unknown): string {
  return getIpcErrorMessage(error, {
    fallback: 'Não foi possível concluir a operação.',
  })
}

function isTrackingRoute(pathname: string): boolean {
  return pathname.startsWith('/tickets/mine')
}

function getStepDisplayLabel(workflows: Workflow[], stepId: string): string {
  if (WORKFLOW_STEP_LABELS[stepId]) return WORKFLOW_STEP_LABELS[stepId]
  for (const workflow of workflows) {
    const step = workflow.steps.find((item) => item.id === stepId)
    if (step) return step.name
  }
  return stepId
}

export default function TicketListPage(): JSX.Element {
  const location = useLocation()
  const currentUser = useAuthStore((s) => s.user)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [scope, setScope] = useState<TicketListScope>('accessible')
  const [priorityFilter, setPriorityFilter] = useState<'all' | TicketPriority>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all')
  const [search, setSearch] = useState('')

  const trackingMode = isTrackingRoute(location.pathname)

  const statuses = useMemo(() => ['all', ...new Set(tickets.map((ticket) => ticket.status))], [tickets])

  const stepLabelById = useMemo(() => {
    return new Map(statuses.map((status) => [status, getStepDisplayLabel(workflows, status)]))
  }, [statuses, workflows])

  const filteredTickets = useMemo(
    () =>
      tickets.filter((ticket) => {
        const byPriority = priorityFilter === 'all' || ticket.priority === priorityFilter
        const byStatus = statusFilter === 'all' || ticket.status === statusFilter
        const term = search.trim().toLowerCase()
        const bySearch =
          !term ||
          getTicketDisplayId(ticket).toLowerCase().includes(term) ||
          ticket.title.toLowerCase().includes(term) ||
          ticket.description.toLowerCase().includes(term) ||
          ticket.requester.name.toLowerCase().includes(term)
        return byPriority && byStatus && bySearch
      }),
    [tickets, priorityFilter, search, statusFilter],
  )

  async function loadTickets(nextScope: TicketListScope, nextTrackingMode = trackingMode): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const [ticketResult, workflowResult] = await Promise.all([
        nextTrackingMode
          ? ipc.listTickets({ queue: 'all', scope: nextScope })
          : ipc.listTickets({ queue: 'mine' }),
        ipc.listWorkflows(),
      ])
      setTickets(ticketResult)
      setWorkflows(workflowResult)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const nextTrackingMode = isTrackingRoute(location.pathname)
    const nextScope: TicketListScope = nextTrackingMode ? 'accessible' : 'accessible'
    setScope(nextScope)
    setPriorityFilter('all')
    setStatusFilter('all')
    setSearch('')
    void loadTickets(nextScope, nextTrackingMode)
  }, [location.pathname])

  async function handleScopeChange(nextScope: TicketListScope): Promise<void> {
    setScope(nextScope)
    setPriorityFilter('all')
    setStatusFilter('all')
    await loadTickets(nextScope)
  }

  async function handleCreate(payload: CreateTicketPayload): Promise<void> {
    setError(null)
    setFeedback(null)
    setIsSubmitting(true)
    try {
      const created = await ipc.createTicket(
        sanitizeCreateTicketPayload({
          ...payload,
          requesterName: payload.requesterName || currentUser?.name || 'Solicitante',
          requesterUserId: payload.requesterUserId ?? currentUser?.id,
        }),
      )
      setFeedback(`Ticket ${getTicketDisplayId(created)} criado com sucesso.`)
      setShowForm(false)
      await loadTickets(scope)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOpenChange(open: boolean): void {
    setShowForm(open)
    if (!open) {
      setError(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={trackingMode ? 'Acompanhar solicitações' : 'Tickets'}
        description={
          trackingMode
            ? 'Consulte as solicitações abertas por você, acompanhadas, participadas ou acessíveis ao seu perfil.'
            : 'Fila de trabalho com os tickets atualmente atribuídos a você.'
        }
      >
        <Button
          onClick={() => {
            setFormKey((k) => k + 1)
            setShowForm(true)
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo ticket
        </Button>
      </PageHeader>

      {feedback ? <StatusAlert variant="success" message={feedback} /> : null}

      <Dialog open={showForm} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo ticket</DialogTitle>
            <DialogDescription>
              Preencha os dados do solicitante e da solicitação para abrir um chamado manualmente.
            </DialogDescription>
          </DialogHeader>

          {error && showForm ? <StatusAlert variant="error" message={error} /> : null}

          <Card className="w-full border-0 bg-transparent shadow-none">
            <CardContent className="p-0">
              <DynamicTicketForm
                key={formKey}
                currentUser={currentUser}
                isSubmitting={isSubmitting}
                onCancel={() => setShowForm(false)}
                onSubmit={handleCreate}
              />
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
      <TicketActionDialog
        open={Boolean(selectedTicketId)}
        ticketId={selectedTicketId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedTicketId(null)
        }}
        onChanged={() => loadTickets(scope)}
      />

      {error && !showForm ? <StatusAlert variant="error" message={error} /> : null}

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="surface-card h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {trackingMode ? (
              <div className="space-y-2">
                <Label htmlFor="ticket-scope">Escopo de consulta</Label>
                <Select value={scope} onValueChange={(value) => void handleScopeChange(value as TicketListScope)}>
                  <SelectTrigger id="ticket-scope" className="h-auto min-h-10 whitespace-normal text-left">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((item, index) => (
                      <div key={item}>
                        {index === 1 ? <SelectSeparator /> : null}
                        <SelectItem value={item} className="whitespace-normal py-2">
                          {TICKET_LIST_SCOPE_LABELS[item]}
                        </SelectItem>
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="ticket-search">Pesquisar</Label>
              <input
                id="ticket-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ID, solicitante ou descrição"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority-filter">Prioridade</Label>
              <Select
                value={priorityFilter}
                onValueChange={(value) => setPriorityFilter(value as 'all' | TicketPriority)}
              >
                <SelectTrigger id="priority-filter">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas prioridades</SelectItem>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === 'all'
                        ? 'Todos os status'
                        : (stepLabelById.get(status) ?? status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setPriorityFilter('all')
                setStatusFilter('all')
                setSearch('')
              }}
            >
              Limpar filtros
            </Button>
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-lg">Lista de tickets</CardTitle>
            <CardDescription>
              {filteredTickets.length} {filteredTickets.length === 1 ? 'chamado' : 'chamados'}{' '}
              {trackingMode
                ? `em ${TICKET_LIST_SCOPE_LABELS[scope].toLowerCase()}`
                : 'na sua fila de trabalho'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <InlineLoader rows={5} />
            ) : filteredTickets.length === 0 ? (
              <EmptyState
                icon={TicketIcon}
                title="Nenhum ticket encontrado"
                description="Crie um novo chamado ou altere o escopo e os filtros para ver mais resultados."
                action={
                  <Button
                    onClick={() => {
                      setFormKey((k) => k + 1)
                      setShowForm(true)
                    }}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Novo ticket
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-[140px] font-semibold">ID</TableHead>
                      <TableHead className="w-[200px] font-semibold">Solicitante</TableHead>
                      <TableHead className="min-w-[200px] font-semibold">Descrição</TableHead>
                      <TableHead className="font-semibold">Prioridade</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="hidden font-semibold md:table-cell">SLA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.map((ticket) => (
                      <TableRow
                        key={ticket.id}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setSelectedTicketId(ticket.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setSelectedTicketId(ticket.id)
                          }
                        }}
                      >
                        <TableCell className="font-mono text-xs">
                          <span className="font-medium text-primary">
                            {getTicketDisplayId(ticket)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{ticket.requester.name}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                          {ticket.description || ticket.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant={PRIORITY_VARIANT[ticket.priority]}>{ticket.priority}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {getStepDisplayLabel(workflows, ticket.status)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <SlaIndicator status={ticket.sla.status} deadline={ticket.sla.deadline} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
