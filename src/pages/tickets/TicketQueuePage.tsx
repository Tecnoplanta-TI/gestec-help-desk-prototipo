import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ListTicketsFilterPayload, Ticket, TicketQueue } from '../../../shared/types'
import { ZEEV_STEP_LABELS } from '../../../shared/lib/zeev-steps'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { EmptyState } from '@/components/shared/EmptyState'
import { InlineLoader } from '@/components/shared/PageLoader'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const QUEUE_TITLES: Record<TicketQueue, string> = {
  all: 'Todos os tickets',
  mine: 'Meus tickets',
  triage: 'Fila de triagem',
  service: 'Fila de atendimento',
  approvals_it: 'Aprovações — Gestor TI',
  approvals_app: 'Aprovações — Gestor App',
  cancellation: 'Aprovações — Cancelamento',
}

interface TicketQueuePageProps {
  queue: TicketQueue
  ticketLinkPath?: (ticketId: string) => string
}

export default function TicketQueuePage({
  queue,
  ticketLinkPath = (id) => `/tickets/${id}`,
}: TicketQueuePageProps): JSX.Element {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filter: ListTicketsFilterPayload = { queue }
      const data = await ipc.listTickets(filter)
      setTickets(data)
    } catch (e) {
      setError(getIpcErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [queue])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <PageHeader title={QUEUE_TITLES[queue]} description="Tickets filtrados por etapa do fluxo Zeev" />
      {error && <StatusAlert variant="error" message={error} />}
      {loading ? (
        <InlineLoader />
      ) : tickets.length === 0 ? (
        <EmptyState title="Nenhum ticket nesta fila" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link className="text-primary hover:underline" to={ticketLinkPath(t.id)}>
                    {t.ticketNumber ?? t.id.slice(0, 8)}
                  </Link>
                </TableCell>
                <TableCell>{t.title}</TableCell>
                <TableCell>{t.type}</TableCell>
                <TableCell>
                  <Badge>{t.priority}</Badge>
                </TableCell>
                <TableCell>{ZEEV_STEP_LABELS[t.status] ?? t.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
