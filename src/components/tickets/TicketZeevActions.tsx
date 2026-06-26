import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Ticket, User } from '../../../shared/types'
import { ZEEV_STEPS } from '../../../shared/lib/zeev-steps'
import { hasPermission } from '../../../shared/lib/permissions'
import { ipc } from '@/lib/ipc'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TicketZeevActionsProps {
  ticket: Ticket
  user: User | null
  users: User[]
  onUpdated: (ticket: Ticket) => void
}

export function TicketZeevActions({
  ticket,
  user,
  users,
  onUpdated,
}: TicketZeevActionsProps): JSX.Element | null {
  const [justification, setJustification] = useState('')
  const [busy, setBusy] = useState(false)

  if (!user) return null

  async function run(action: () => Promise<Ticket>) {
    setBusy(true)
    try {
      onUpdated(await action())
    } finally {
      setBusy(false)
    }
  }

  if (ticket.status === ZEEV_STEPS.awaiting_it_manager_approval && hasPermission(user, 'it_manager')) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aprovação Gestor TI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Justificativa (obrigatória se recusar)"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                run(() => ipc.approveTicket({ ticketId: ticket.id, approved: true, stage: 'it_manager' }))
              }
            >
              Aprovar
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                run(() =>
                  ipc.approveTicket({
                    ticketId: ticket.id,
                    approved: false,
                    stage: 'it_manager',
                    justification,
                  }),
                )
              }
            >
              Recusar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (ticket.status === ZEEV_STEPS.awaiting_app_manager_approval && hasPermission(user, 'app_manager')) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aprovação Gestor App</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} />
          <div className="flex gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                run(() => ipc.approveTicket({ ticketId: ticket.id, approved: true, stage: 'app_manager' }))
              }
            >
              Aprovar
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                run(() =>
                  ipc.approveTicket({
                    ticketId: ticket.id,
                    approved: false,
                    stage: 'app_manager',
                    justification,
                  }),
                )
              }
            >
              Recusar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (ticket.status === ZEEV_STEPS.in_triage && hasPermission(user, 'triage')) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Triagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Use a tela dedicada de triagem para revisar classificação, checklist e atribuir o
            atendente.
          </p>
          <Button asChild>
            <Link to={`/triage/${ticket.id}`}>Abrir triagem</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (
    ticket.status === ZEEV_STEPS.awaiting_cancellation_approval &&
    hasPermission(user, 'cancellation_approver')
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aprovação cancelamento</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            disabled={busy}
            onClick={() =>
              run(() =>
                ipc.approveTicket({ ticketId: ticket.id, approved: true, stage: 'cancellation' }),
              )
            }
          >
            Aprovar
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() =>
              run(() =>
                ipc.approveTicket({
                  ticketId: ticket.id,
                  approved: false,
                  stage: 'cancellation',
                  justification,
                }),
              )
            }
          >
            Recusar
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (ticket.status === ZEEV_STEPS.awaiting_service && ticket.assigneeId === user.id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Atendimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Use a tela de contato inicial para revisar o ticket e iniciar o atendimento.
          </p>
          <Button asChild>
            <Link to={`/service/${ticket.id}`}>Abrir contato inicial</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (ticket.status === ZEEV_STEPS.in_service && (ticket.assigneeId === user.id || hasPermission(user, 'admin'))) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Atendimento em andamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Registre apontamentos, equipamentos entregues e conclua o atendimento na tela dedicada.
          </p>
          <Button asChild>
            <Link to={`/service/${ticket.id}`}>Continuar atendimento</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (ticket.status === ZEEV_STEPS.awaiting_completion_approval && hasPermission(user, 'triage')) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aprovação de conclusão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Revise apontamentos, cobrança e equipamentos antes de aprovar a conclusão.
          </p>
          <Button asChild>
            <Link to={`/completion/${ticket.id}`}>Aprovar conclusão</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (ticket.status === ZEEV_STEPS.awaiting_evaluation) {
    const isRequester =
      ticket.requesterUserId === user.id ||
      ticket.requester.email.toLowerCase() === user.email.toLowerCase()
    if (!isRequester) return null
    return (
      <Card>
        <CardHeader>
          <CardTitle>Avaliação do serviço</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Avalie o atendimento recebido. Notas baixas exigem justificativa.
          </p>
          <Button asChild>
            <Link to={`/tickets/${ticket.id}/evaluate`}>Avaliar atendimento</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return null
}
