import { hasPermission } from './permissions'
import type { Ticket, User } from '../types'

export type TicketListScope = 'mine' | 'participated' | 'accessible'

export const TICKET_LIST_SCOPE_LABELS: Record<TicketListScope, string> = {
  mine: 'Minhas solicitações',
  participated: 'Solicitações que participei e tenho acesso',
  accessible: 'Todas as solicitações que tenho acesso',
}

export function isTicketRequester(ticket: Ticket, user: Pick<User, 'id' | 'email'>): boolean {
  if (ticket.requesterUserId && ticket.requesterUserId === user.id) return true
  return ticket.requester.email.toLowerCase() === user.email.toLowerCase()
}

/** Usuário envolvido no ticket, mas não como solicitante. */
export function userParticipatedInTicket(ticket: Ticket, user: Pick<User, 'id'>): boolean {
  const userId = user.id

  if (ticket.assigneeId === userId) return true
  if (ticket.additionalAssigneeId === userId) return true
  if (ticket.triageAssigneeId === userId) return true
  if (ticket.appManagerId === userId) return true
  if (ticket.cancellationApproverId === userId) return true
  if (ticket.itManagerDecision?.decidedBy === userId) return true
  if (ticket.appManagerDecision?.decidedBy === userId) return true
  if (ticket.cancellationDecision?.decidedBy === userId) return true
  if (ticket.comments?.some((c) => c.authorId === userId)) return true
  if (ticket.tasks?.some((t) => t.assigneeId === userId)) return true
  if (ticket.appointments?.some((a) => a.technicianId === userId)) return true
  if (ticket.workflowHistory?.some((h) => h.changedBy === userId)) return true
  if (ticket.attachments?.some((a) => a.uploadedBy === userId)) return true

  return false
}

/** Tickets visíveis para o usuário no escopo "todas que tenho acesso". */
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

export function filterTicketsByScope(
  tickets: Ticket[],
  scope: TicketListScope,
  user: Pick<User, 'id' | 'email' | 'role' | 'permissions'>,
): Ticket[] {
  if (scope === 'mine') {
    return tickets.filter((t) => isTicketRequester(t, user))
  }
  if (scope === 'participated') {
    return tickets.filter((t) => userParticipatedInTicket(t, user))
  }
  return tickets.filter((t) => userCanAccessTicket(t, user))
}
