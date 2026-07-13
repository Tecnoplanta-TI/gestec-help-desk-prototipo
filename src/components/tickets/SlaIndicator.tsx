import type { SlaStatus } from '../../../shared/types'
import { formatSlaRemaining } from '../../lib/sla'

const STATUS_LABEL: Record<SlaStatus, string> = {
  ok: 'Dentro do SLA',
  warning: 'Próximo do prazo',
  overdue: 'Fora do SLA',
}

const STATUS_CLASS: Record<SlaStatus, string> = {
  ok: 'sla-ok',
  warning: 'sla-warning',
  overdue: 'sla-overdue',
}

interface SlaIndicatorProps {
  status: SlaStatus
  deadline?: string
  compact?: boolean
}

export function SlaIndicator({ status, deadline, compact = false }: SlaIndicatorProps): JSX.Element {
  const containerClass = [
    'inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-left text-xs font-medium leading-snug',
    'whitespace-normal break-words',
    STATUS_CLASS[status],
  ].join(' ')

  if (compact || !deadline) {
    return <span className={containerClass}>{STATUS_LABEL[status]}</span>
  }

  return (
    <span className={containerClass} title={`Prazo: ${new Date(deadline).toLocaleString('pt-BR')}`}>
      {STATUS_LABEL[status]} · {formatSlaRemaining(deadline)}
    </span>
  )
}
