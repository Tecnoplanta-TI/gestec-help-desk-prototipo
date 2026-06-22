import type { Ticket } from '../../shared/types'

export function normalizeTicket(ticket: Ticket): Ticket {
  return {
    ...ticket,
    tasks: ticket.tasks ?? [],
    comments: ticket.comments ?? [],
    cancellationItems: ticket.cancellationItems ?? [],
    isCancelled: ticket.isCancelled ?? false,
    expenses: (ticket.expenses ?? []).map((e) => ({
      ...e,
      receiptFiles: e.receiptFiles ?? [],
      updatedAt: e.updatedAt ?? e.createdAt,
    })),
    attachments: ticket.attachments ?? [],
    appointments: ticket.appointments ?? [],
    deliveredEquipment: ticket.deliveredEquipment ?? [],
  }
}
