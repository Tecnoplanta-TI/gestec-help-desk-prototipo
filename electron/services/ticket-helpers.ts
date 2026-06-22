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
  }
}

export function calcMinutesBetween(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const start = sh * 60 + sm
  const end = eh * 60 + em
  return end - start
}
