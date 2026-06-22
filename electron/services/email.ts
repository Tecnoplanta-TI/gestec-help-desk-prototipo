import type { Ticket, User } from '../../shared/types'
import { getAppConfig } from './app-config'
import { writeAuditLog } from './audit'

export type EmailEvent =
  | 'melhoria_aguardando_ti'
  | 'melhoria_recusada_ti'
  | 'melhoria_aguardando_app'
  | 'melhoria_recusada_app'
  | 'melhoria_aprovada'
  | 'ticket_recusado_triagem'
  | 'ticket_aguardando_ajuste'
  | 'ajuste_7_dias'
  | 'atendimento_iniciado'
  | 'ticket_concluido'
  | 'cancelamento_aprovado'
  | 'cancelamento_recusado'
  | 'avaliacao_pendente'
  | 'avaliacao_recebida'

const EVENT_SUBJECTS: Record<EmailEvent, string> = {
  melhoria_aguardando_ti: 'Melhoria aguardando aprovação do Gestor TI',
  melhoria_recusada_ti: 'Melhoria recusada pelo Gestor TI',
  melhoria_aguardando_app: 'Melhoria aguardando aprovação do Gestor App',
  melhoria_recusada_app: 'Melhoria recusada pelo Gestor App',
  melhoria_aprovada: 'Melhoria aprovada',
  ticket_recusado_triagem: 'Ticket recusado na triagem',
  ticket_aguardando_ajuste: 'Ticket aguardando ajuste',
  ajuste_7_dias: 'Ticket cancelado por prazo de ajuste',
  atendimento_iniciado: 'Atendimento iniciado',
  ticket_concluido: 'Ticket concluído',
  cancelamento_aprovado: 'Cancelamento aprovado',
  cancelamento_recusado: 'Cancelamento recusado',
  avaliacao_pendente: 'Avaliação pendente',
  avaliacao_recebida: 'Avaliação recebida',
}

function buildBody(
  event: EmailEvent,
  ticket: Ticket,
  recipient: Pick<User, 'name'>,
  extra?: { justification?: string },
): string {
  const lines = [
    `Olá ${recipient.name},`,
    '',
    EVENT_SUBJECTS[event],
    '',
    `Ticket: ${ticket.ticketNumber ?? ticket.id}`,
    `Título: ${ticket.title}`,
    `Tipo: ${ticket.type}`,
    `Prioridade: ${ticket.priority}`,
  ]
  if (extra?.justification) {
    lines.push('', `Justificativa: ${extra.justification}`)
  }
  lines.push('', '—', 'gestec · help desk')
  return lines.join('\n')
}

export async function sendTicketEmail(
  event: EmailEvent,
  ticket: Ticket,
  recipient: Pick<User, 'email' | 'name'>,
  extra?: { justification?: string },
): Promise<void> {
  const config = await getAppConfig()
  const subject = `[Gestec] ${EVENT_SUBJECTS[event]} — ${ticket.ticketNumber ?? ticket.id}`
  const body = buildBody(event, ticket, recipient, extra)

  if (!config.emailEnabled) {
    console.info('[email] disabled — would send:', {
      to: recipient.email,
      subject,
      body: body.slice(0, 120),
    })
    return
  }

  console.info('[email] send', { to: recipient.email, subject, smtpHost: config.smtpHost })
}

export async function notifyTicketEmail(
  event: EmailEvent,
  ticket: Ticket,
  recipient: Pick<User, 'email' | 'name'>,
  userId: string,
  extra?: { justification?: string },
): Promise<void> {
  try {
    await sendTicketEmail(event, ticket, recipient, extra)
    await writeAuditLog({
      entityType: 'ticket',
      entityId: ticket.id,
      action: 'notification_sent',
      userId,
      field: 'email',
      newValue: event,
    })
  } catch (error) {
    console.error('[email] failed', event, error)
  }
}
