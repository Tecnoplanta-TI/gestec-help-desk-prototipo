import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Columns3 } from 'lucide-react'
import type { Ticket, Workflow } from '../../../shared/types'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { SlaIndicator } from '@/components/tickets/SlaIndicator'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { EmptyState } from '@/components/shared/EmptyState'
import { InlineLoader } from '@/components/shared/PageLoader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

function getErrorMessage(error: unknown): string {
  return getIpcErrorMessage(error, { fallback: 'Não foi possível carregar o kanban.' })
}

export default function TicketKanbanPage(): JSX.Element {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load(): Promise<void> {
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

    void load()
  }, [])

  const grouped = useMemo(() => {
    const bucket = new Map<string, Ticket[]>()
    for (const ticket of tickets) {
      const current = bucket.get(ticket.status)
      if (current) {
        current.push(ticket)
      } else {
        bucket.set(ticket.status, [ticket])
      }
    }
    return bucket
  }, [tickets])

  const columns = useMemo(() => {
    const defaultWorkflow = workflows.find((workflow) => workflow.isDefault) ?? workflows[0]
    const stepLabelById = new Map<string, string>()
    if (defaultWorkflow) {
      for (const step of defaultWorkflow.steps) {
        stepLabelById.set(step.id, step.name)
      }
    }

    const baseColumns = defaultWorkflow
      ? [...defaultWorkflow.steps]
          .sort((a, b) => a.order - b.order)
          .map((step) => ({ id: step.id, title: step.name }))
      : []

    const existing = new Set(baseColumns.map((column) => column.id))
    const dynamic = Array.from(grouped.keys())
      .filter((status) => !existing.has(status))
      .map((status) => ({ id: status, title: stepLabelById.get(status) ?? status }))
    return [...baseColumns, ...dynamic]
  }, [grouped, workflows])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kanban"
        description="Visualize os chamados organizados por etapa do workflow."
      />

      {error ? <StatusAlert variant="error" message={error} /> : null}

      {loading ? (
        <InlineLoader rows={4} />
      ) : columns.length === 0 ? (
        <EmptyState
          icon={Columns3}
          title="Nenhuma coluna disponível"
          description="Configure um workflow padrão em Configurações para visualizar o kanban."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => {
            const columnTickets = grouped.get(column.id) ?? []
            return (
              <Card key={column.id} className="surface-card flex flex-col">
                <CardHeader className="border-b py-3">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span className="truncate">{column.title}</span>
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      {columnTickets.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                  <ScrollArea className="h-[min(60vh,520px)]">
                    <div className="space-y-2 p-3">
                      {columnTickets.length === 0 ? (
                        <p className="py-6 text-center text-xs text-muted-foreground">
                          Nenhum ticket nesta etapa
                        </p>
                      ) : (
                        columnTickets.map((ticket) => (
                          <Link
                            key={ticket.id}
                            to={`/tickets/${ticket.id}`}
                            className="block rounded-lg border bg-background p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <p className="line-clamp-2 text-sm font-medium leading-snug">{ticket.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{ticket.requester.name}</p>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                {ticket.priority}
                              </Badge>
                              <span className="truncate text-[10px] capitalize text-muted-foreground">
                                {ticket.source}
                              </span>
                            </div>
                            <div className="mt-2">
                              <SlaIndicator
                                compact
                                status={ticket.sla.status}
                                deadline={ticket.sla.deadline}
                              />
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
