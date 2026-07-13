import { hasPermission } from './permissions'
import { WORKFLOW_STEPS } from './workflow-steps'
import type { Ticket, User } from '../types'

export type TicketListScope = 'mine' | 'participated' | 'accessible'

export const TICKET_LIST_SCOPE_LABELS: Record<TicketListScope, string> = {
  mine: 'Solicitações abertas por mim',
  participated: 'Solicitações em que participei',
  accessible: 'Todas as solicitações que posso consultar',
}

export function isTicketRequester(ticket: Ticket, user: Pick<User, 'id' | 'email'>): boolean {
  if (ticket.requesterUserId && ticket.requesterUserId === user.id) return true
  return ticket.requester.email.toLowerCase() === user.email.toLowerCase()
}

export function isTicketAssignedToUser(ticket: Ticket, user: Pick<User, 'id'>): boolean {
  const userId = user.id

  if (ticket.assigneeId === userId) return true
  if (ticket.additionalAssigneeId === userId) return true
  if (ticket.triageAssigneeId === userId) return true
  if (
    ticket.status === WORKFLOW_STEPS.awaiting_app_manager_approval &&
    ticket.appManagerId === userId
  ) {
    return true
  }
  if (
    ticket.status === WORKFLOW_STEPS.awaiting_cancellation_approval &&
    ticket.cancellationApproverId === userId
  ) {
    return true
  }
  if (ticket.tasks?.some((task) => task.status !== 'done' && task.assigneeId === userId)) {
    return true
  }

  return false
}

export function userParticipatedInTicket(ticket: Ticket, user: Pick<User, 'id'>): boolean {
  const userId = user.id

  if (isTicketAssignedToUser(ticket, user)) return true
  if (ticket.itManagerDecision?.decidedBy === userId) return true
  if (ticket.appManagerDecision?.decidedBy === userId) return true
  if (ticket.cancellationDecision?.decidedBy === userId) return true
  if (ticket.comments?.some((comment) => comment.authorId === userId)) return true
  if (ticket.appointments?.some((appointment) => appointment.technicianId === userId)) return true
  if (ticket.workflowHistory?.some((entry) => entry.changedBy === userId)) return true
  if (ticket.attachments?.some((attachment) => attachment.uploadedBy === userId)) return true

  return false
}

export function userCanAccessTicket(
  ticket: Ticket,
  user: Pick<User, 'id' | 'email' | 'role' | 'permissions'>,
): boolean {
  if (isTicketRequester(ticket, user)) return true
  if (userParticipatedInTicket(ticket, user)) return true
  if (hasPermission(user, 'admin') || hasPermission(user, 'triage')) return true
  if (user.role === 'manager' || user.role === 'admin') return true
  return false
}

export function filterTicketsForWorkQueue(
  tickets: Ticket[],
  user: Pick<User, 'id'>,
): Ticket[] {
  return tickets.filter((ticket) => isTicketAssignedToUser(ticket, user))
}

export function filterTicketsByScope(
  tickets: Ticket[],
  scope: TicketListScope,
  user: Pick<User, 'id' | 'email' | 'role' | 'permissions'>,
): Ticket[] {
  if (scope === 'mine') return tickets.filter((ticket) => isTicketRequester(ticket, user))
  if (scope === 'participated') {
    return tickets.filter((ticket) => userParticipatedInTicket(ticket, user))
  }
  return tickets.filter((ticket) => userCanAccessTicket(ticket, user))
}
