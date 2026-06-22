import type { Ticket } from '../../shared/types'

/** Valor hora padrão para tickets (até RatesPage ser implementada) */
export const DEFAULT_TICKET_HOURLY_RATE = 105

export interface TicketBillingSummary {
  hourlyRate: number
  totalMinutes: number
  serviceValue: number
  materialCost: number
  finalValue: number
}

export function computeTicketBilling(
  ticket: Ticket,
  hourlyRate = DEFAULT_TICKET_HOURLY_RATE,
): TicketBillingSummary {
  const totalMinutes = (ticket.appointments ?? []).reduce((sum, a) => sum + a.totalMinutes, 0)
  const serviceValue = (totalMinutes / 60) * hourlyRate
  const materialCost = (ticket.expenses ?? []).reduce((sum, e) => sum + e.totalValue, 0)
  return {
    hourlyRate,
    totalMinutes,
    serviceValue,
    materialCost,
    finalValue: serviceValue + materialCost,
  }
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
