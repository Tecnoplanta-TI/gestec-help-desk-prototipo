import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Ticket as TicketIcon } from 'lucide-react'
import type { CreateTicketPayload, Ticket, TicketPriority, Workflow } from '../../../shared/types'
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

function getErrorMessage(error: unknown): string {
  return getIpcErrorMessage(error, {
    fallback: 'Não foi possível concluir a operação.',
  })
}

export default function TicketListPage(): JSX.Element {
  const currentUser = useAuthStore((s) => s.user)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  async function loadTickets(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const [ticketResult, workflowResult] = await Promise.all([
        ipc.listTickets(),
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
    void loadTickets()
  }, [])

  async function handleCreate(payload: CreateTicketPayload): Promise<void> {
    setError(null)
    setFeedback(null)
    setIsSubmitting(true)
    try {
      const created = await ipc.createTicket(
        sanitizeCreateTicketPayload({
          ...payload,
          requesterName: payload.requesterName || currentUser?.name || 'Solicitante',
          requesterEmail: payload.requesterEmail || currentUser?.email || '',
          requesterUserId: payload.requesterUserId ?? currentUser?.id,
        }),
      )
      setFeedback(`Ticket ${created.ticketNumber ?? created.id.slice(0, 8)} criado com sucesso.`)
      setShowForm(false)
      await loadTickets()
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
        title="Tickets"
        description="Abra chamados manualmente e acompanhe o andamento de cada solicitação."
      >
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo ticket
        </Button>
      </PageHeader>

      {feedback ? <StatusAlert variant="success" message={feedback} /> : null}

      <Dialog open={showForm} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo ticket</DialogTitle>
            <DialogDescription>
              Preencha os dados do solicitante e da solicitação para abrir um chamado manualmente.
            </DialogDescription>
          </DialogHeader>

          {error && showForm ? <StatusAlert variant="error" message={error} /> : null}

          <DynamicTicketForm
            currentUser={currentUser}
            isSubmitting={isSubmitting}
            onCancel={() => setShowForm(false)}
            onSubmit={handleCreate}
          />
        </DialogContent>
      </Dialog>

      {error && !showForm ? <StatusAlert variant="error" message={error} /> : null}

      <Card className="surface-card">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Lista de tickets</CardTitle>
            <CardDescription>
              {filteredTickets.length} {filteredTickets.length === 1 ? 'chamado' : 'chamados'}{' '}
              {priorityFilter !== 'all' || statusFilter !== 'all' ? 'filtrados' : 'no total'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={priorityFilter}
              onValueChange={(value) => setPriorityFilter(value as 'all' | TicketPriority)}
            >
              <SelectTrigger className="w-[160px]">
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
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
        </CardHeader>
        <CardContent>
          {loading ? (
            <InlineLoader rows={5} />
          ) : filteredTickets.length === 0 ? (
            <EmptyState
              icon={TicketIcon}
              title="Nenhum ticket encontrado"
              description="Crie um novo chamado ou ajuste os filtros para ver mais resultados."
              action={
                <Button onClick={() => setShowForm(true)} className="gap-2">
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
                    <TableHead className="font-semibold">ID</TableHead>
                    <TableHead className="font-semibold">Título</TableHead>
                    <TableHead className="hidden font-semibold sm:table-cell">Solicitante</TableHead>
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
                          {ticket.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate font-medium">{ticket.title}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {ticket.requester.name}
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
  )
}
