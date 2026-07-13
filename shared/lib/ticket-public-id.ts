import type { Ticket } from '../types'

const PUBLIC_TICKET_ID_PATTERN = /^#\d{1,9}$/

export function isPublicTicketId(value: string | undefined): value is string {
  return Boolean(value && PUBLIC_TICKET_ID_PATTERN.test(value))
}

export function formatPublicTicketId(value: number): string {
  const safe = Math.max(1, Math.min(999_999_999, Math.trunc(value)))
  return `#${safe}`
}

export function getTicketDisplayId(ticket: Pick<Ticket, 'id' | 'ticketNumber'>): string {
  if (isPublicTicketId(ticket.ticketNumber)) return ticket.ticketNumber
  return '#0'
}

export function getNextPublicTicketId(tickets: Array<Pick<Ticket, 'ticketNumber'>>): string {
  const used = new Set(
    tickets
      .map((ticket) => ticket.ticketNumber)
      .filter(isPublicTicketId)
      .map((ticketNumber) => Number(ticketNumber.slice(1))),
  )

  let next = 1
  while (used.has(next)) next += 1
  return formatPublicTicketId(next)
}
