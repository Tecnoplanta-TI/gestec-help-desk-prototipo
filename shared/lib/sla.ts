import { addHours, differenceInMinutes, isPast } from 'date-fns'
import type { SlaStatus } from '../types'

export function calcDeadline(createdAt: string, hours: number): string {
  return addHours(new Date(createdAt), hours).toISOString()
}

export function getSlaStatus(createdAt: string, deadline: string): SlaStatus {
  const now = new Date()
  const deadlineDate = new Date(deadline)

  if (isPast(deadlineDate)) {
    return 'overdue'
  }

  const totalMinutes = differenceInMinutes(deadlineDate, new Date(createdAt))
  const remainingMinutes = differenceInMinutes(deadlineDate, now)
  const remainingPercent = totalMinutes > 0 ? remainingMinutes / totalMinutes : 0

  if (remainingPercent <= 0.2) {
    return 'warning'
  }

  return 'ok'
}

export function formatSlaRemaining(deadline: string): string {
  const now = new Date()
  const deadlineDate = new Date(deadline)
  const diffMinutes = differenceInMinutes(deadlineDate, now)

  if (diffMinutes < 0) {
    const absMinutes = Math.abs(diffMinutes)
    const h = Math.floor(absMinutes / 60)
    const m = absMinutes % 60
    return h > 0 ? `Expirado ha ${h}h ${m}min` : `Expirado ha ${m}min`
  }

  const h = Math.floor(diffMinutes / 60)
  const m = diffMinutes % 60

  if (h > 0) {
    return `${h}h ${m}min restantes`
  }
  return `${m}min restantes`
}
