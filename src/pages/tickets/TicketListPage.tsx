import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Plus, Ticket as TicketIcon } from 'lucide-react'
import type { CreateTicketPayload, Ticket, TicketPriority, TicketListScope, Workflow } from '../../../shared/types'
import { TICKET_LIST_SCOPE_LABELS } from '../../../shared/lib/ticket-access'
import { ZEEV_STEP_LABELS } from '../../../shared/lib/zeev-steps'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/authStore'
import { sanitizeCreateTicketPayload } from '../../../shared/lib/ticket-payload'
import { DynamicTicketForm } from '@/components/tickets/DynamicTicketForm'
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

const SCOPES: TicketListScope[] = ['mine', 'participated', 'accessible']

function getErrorMessage(error: unknown): string {
  return getIpcErrorMessage(error, {
    fallback: 'Não foi possível concluir a operação.',
  })
}

function resolveInitialScope(pathname: string): TicketListScope {
  return pathname.startsWith('/tickets/mine') ? 'mine' : 'mine'
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
  const [scope, setScope] = useState<TicketListScope>(() => resolveInitialScope(location.pathname))
  const [priorityFilter, setPriorityFilter] = useState<'all' | TicketPriority>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all')

  const statuses = useMemo(() => ['all', ...new Set(tickets.map((ticket) => ticket.status))], [tickets])

  const stepLabelById = useMemo(() => {
    const map = new Map<string, string>(Object.entries(ZEEV_STEP_LABELS))
    for (const workflow of workflows) {
      for (const step of workflow.steps) {
        map.set(step.id, step.name)
      }
    }
    return map
  }, [workflows])

  const filteredTickets = useMemo(
    () =>
      tickets.filter((ticket) => {
        const byPriority = priorityFilter === 'all' || ticket.priority === priorityFilter
        const byStatus = statusFilter === 'all' || ticket.status === statusFilter
        return byPriority && byStatus
      }),
    [tickets, priorityFilter, statusFilter],
  )

  async function loadTickets(nextScope: TicketListScope): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const [ticketResult, workflowResult] = await Promise.all([
        ipc.listTickets({ queue: 'all', scope: nextScope }),
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
    const nextScope = resolveInitialScope(location.pathname)
    setScope(nextScope)
    void loadTickets(nextScope)
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
      setFeedback(`Ticket ${created.ticketNumber ?? created.id.slice(0, 8)} criado com sucesso.`)
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
        title="Acompanhar solicitações"
        description="Visualize e filtre os chamados conforme sua participação, como no Zeev."
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

      {error && !showForm ? <StatusAlert variant="error" message={error} /> : null}

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="surface-card h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ticket-scope">Acompanhar solicitação</Label>
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
              em {TICKET_LIST_SCOPE_LABELS[scope].toLowerCase()}
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
                      <TableHead className="hidden font-semibold lg:table-cell">Origem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.map((ticket) => (
                      <TableRow key={ticket.id} className="transition-colors">
                        <TableCell className="font-mono text-xs">
                          <Link
                            className="font-medium text-primary underline-offset-4 hover:underline"
                            to={`/tickets/${ticket.id}`}
                          >
                            {ticket.ticketNumber ?? ticket.id.slice(0, 8)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{ticket.requester.name}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                          {ticket.description || ticket.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant={PRIORITY_VARIANT[ticket.priority]}>{ticket.priority}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {stepLabelById.get(ticket.status) ?? ticket.status}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <SlaIndicator status={ticket.sla.status} deadline={ticket.sla.deadline} />
                        </TableCell>
                        <TableCell className="hidden capitalize text-muted-foreground lg:table-cell">
                          {ticket.source}
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
