import { randomUUID } from 'crypto'
import { addDays } from 'date-fns'
import { hasPermission } from '../../shared/lib/permissions'
import { ZEEV_STEPS } from '../../shared/lib/zeev-steps'
import type {
  ApproveTicketPayload,
  CreateTicketAppointmentPayload,
  CreateTicketTaskPayload,
  ListTicketsFilterPayload,
  SubmitTicketEvaluationPayload,
  Ticket,
  TicketCancellationItem,
  TicketReportStats,
  TriageTicketPayload,
  UpdateTicketPayload,
  UpdateTicketTaskPayload,
  User,
} from '../../shared/types'
import { getAppConfig } from './app-config'
import { writeAuditLog } from './audit'
import { notifyTicketEmail } from './email'
import { getContainer } from './cosmos'
import { calcMinutesBetween, normalizeTicket } from './ticket-helpers'
import { getTicketById, listTickets as listAllTickets } from './ticket'

const TICKETS_CONTAINER = 'tickets'

async function readTicket(id: string): Promise<Ticket> {
  const ticket = await getTicketById(id)
  if (!ticket) throw new Error('TICKET_NOT_FOUND')
  return normalizeTicket(ticket)
}

async function saveTicket(ticket: Ticket): Promise<Ticket> {
  const container = await getContainer(TICKETS_CONTAINER)
  const { resource } = await container.item(ticket.id, ticket.id).replace(ticket)
  return normalizeTicket(resource as Ticket)
}

export async function updateTicket(
  payload: UpdateTicketPayload,
  userId: string,
): Promise<Ticket> {
  const existing = await readTicket(payload.ticketId)
  if (payload.expectedUpdatedAt && existing.updatedAt !== payload.expectedUpdatedAt) {
    throw new Error('CONFLICT')
  }

  const allowedStatuses: string[] = [
    ZEEV_STEPS.awaiting_requester_adjustment,
    ZEEV_STEPS.adjustment_pending,
  ]
  if (!allowedStatuses.includes(existing.status)) {
    throw new Error('TICKET_NOT_EDITABLE')
  }

  const now = new Date().toISOString()
  const updated: Ticket = {
    ...existing,
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
    ...(payload.service !== undefined ? { service: payload.service } : {}),
    ...(payload.unavailableSystem !== undefined ? { unavailableSystem: payload.unavailableSystem } : {}),
    ...(payload.inoperableInfrastructure !== undefined
      ? { inoperableInfrastructure: payload.inoperableInfrastructure }
      : {}),
    ...(payload.applicationProcess !== undefined ? { applicationProcess: payload.applicationProcess } : {}),
    ...(payload.assetCode !== undefined ? { assetCode: payload.assetCode } : {}),
    ...(payload.supportNotes !== undefined ? { supportNotes: payload.supportNotes } : {}),
    ...(payload.level !== undefined ? { level: payload.level } : {}),
    ...(payload.downtimeMinutes !== undefined ? { downtimeMinutes: payload.downtimeMinutes } : {}),
    status: ZEEV_STEPS.in_triage,
    updatedAt: now,
  }

  await writeAuditLog({
    entityType: 'ticket',
    entityId: existing.id,
    action: 'ticket_updated',
    userId,
    workflowStep: existing.status,
  })

  return saveTicket(updated)
}

export async function approveTicket(
  payload: ApproveTicketPayload,
  user: User,
): Promise<Ticket> {
  const existing = await readTicket(payload.ticketId)
  const now = new Date().toISOString()

  if (payload.stage === 'it_manager') {
    if (!hasPermission(user, 'it_manager')) throw new Error('FORBIDDEN')
    if (existing.status !== ZEEV_STEPS.awaiting_it_manager_approval) throw new Error('INVALID_STATUS')

    if (!payload.approved && !payload.justification) throw new Error('JUSTIFICATION_REQUIRED')

    const decision = { approved: payload.approved, justification: payload.justification, decidedBy: user.id, decidedAt: now }
    let status: string = payload.approved
      ? ZEEV_STEPS.awaiting_app_manager_approval
      : ZEEV_STEPS.improvement_rejected_by_it

    if (!payload.approved && payload.justification?.toLowerCase().includes('ajuste')) {
      status = ZEEV_STEPS.awaiting_requester_adjustment
    }

    const updated = await saveTicket({
      ...existing,
      itManagerDecision: decision,
      status,
      ...(status === ZEEV_STEPS.awaiting_requester_adjustment
        ? { adjustmentRequestedAt: now, adjustmentDeadline: addDays(new Date(), 7).toISOString() }
        : {}),
      updatedAt: now,
    })

    void notifyTicketEmail(
      payload.approved ? 'melhoria_aguardando_app' : 'melhoria_recusada_ti',
      updated,
      { email: existing.requester.email, name: existing.requester.name },
      user.id,
      { justification: payload.justification },
    )
    return updated
  }

  if (payload.stage === 'app_manager') {
    if (!hasPermission(user, 'app_manager')) throw new Error('FORBIDDEN')
    if (existing.status !== ZEEV_STEPS.awaiting_app_manager_approval) throw new Error('INVALID_STATUS')

    const decision = { approved: payload.approved, justification: payload.justification, decidedBy: user.id, decidedAt: now }
    const status = payload.approved ? ZEEV_STEPS.in_triage : ZEEV_STEPS.improvement_rejected_by_app

    const updated = await saveTicket({
      ...existing,
      appManagerDecision: decision,
      status,
      updatedAt: now,
    })

    void notifyTicketEmail(
      payload.approved ? 'melhoria_aprovada' : 'melhoria_recusada_app',
      updated,
      { email: existing.requester.email, name: existing.requester.name },
      user.id,
      { justification: payload.justification },
    )
    return updated
  }

  if (payload.stage === 'cancellation') {
    if (!hasPermission(user, 'cancellation_approver')) throw new Error('FORBIDDEN')
    if (existing.status !== ZEEV_STEPS.awaiting_cancellation_approval) throw new Error('INVALID_STATUS')

    const decision = { approved: payload.approved, justification: payload.justification, decidedBy: user.id, decidedAt: now }
    const status = payload.approved ? ZEEV_STEPS.cancellation_completed : ZEEV_STEPS.cancellation_rejected
    const items = (existing.cancellationItems ?? []).map((item) => ({
      ...item,
      status: payload.approved ? ('approved' as const) : ('rejected' as const),
      processedAt: now,
    }))

    const updated = await saveTicket({
      ...existing,
      cancellationDecision: decision,
      cancellationItems: items,
      isCancelled: payload.approved,
      status,
      updatedAt: now,
    })

    void notifyTicketEmail(
      payload.approved ? 'cancelamento_aprovado' : 'cancelamento_recusado',
      updated,
      { email: existing.requester.email, name: existing.requester.name },
      user.id,
    )
    return updated
  }

  throw new Error('INVALID_STAGE')
}

export async function triageTicket(payload: TriageTicketPayload, user: User): Promise<Ticket> {
  if (!hasPermission(user, 'triage')) throw new Error('FORBIDDEN')
  const existing = await readTicket(payload.ticketId)
  if (existing.status !== ZEEV_STEPS.in_triage) throw new Error('INVALID_STATUS')

  const now = new Date().toISOString()
  let status: string
  let assigneeId = existing.assigneeId

  if (payload.decision === 'approve') {
    if (!payload.assigneeId) throw new Error('ASSIGNEE_REQUIRED')
    status = ZEEV_STEPS.awaiting_service
    assigneeId = payload.assigneeId
  } else if (payload.decision === 'reject') {
    if (!payload.justification) throw new Error('JUSTIFICATION_REQUIRED')
    status = ZEEV_STEPS.triage_rejected
  } else {
    status = ZEEV_STEPS.awaiting_requester_adjustment
  }

  const updated = await saveTicket({
    ...existing,
    status,
    assigneeId,
    triageAssigneeId: user.id,
    ...(payload.type ? { type: payload.type } : {}),
    ...(payload.priority ? { priority: payload.priority } : {}),
    ...(payload.level ? { level: payload.level } : {}),
    ...(payload.serviceGroup ? { serviceGroup: payload.serviceGroup } : {}),
    ...(payload.costCenter
      ? { requester: { ...existing.requester, costCenter: payload.costCenter } }
      : {}),
    ...(payload.decision === 'adjustment'
      ? { adjustmentRequestedAt: now, adjustmentDeadline: addDays(new Date(), 7).toISOString() }
      : {}),
    updatedAt: now,
  })

  if (payload.decision === 'reject') {
    void notifyTicketEmail('ticket_recusado_triagem', updated, existing.requester, user.id, {
      justification: payload.justification,
    })
  } else if (payload.decision === 'adjustment') {
    void notifyTicketEmail('ticket_aguardando_ajuste', updated, existing.requester, user.id)
  }

  await writeAuditLog({
    entityType: 'ticket',
    entityId: existing.id,
    action: 'triage',
    userId: user.id,
    newValue: payload.decision,
    justification: payload.justification,
  })

  return updated
}

export async function startTicketService(ticketId: string, user: User): Promise<Ticket> {
  const existing = await readTicket(ticketId)
  if (existing.status !== ZEEV_STEPS.awaiting_service) throw new Error('INVALID_STATUS')
  if (existing.assigneeId && existing.assigneeId !== user.id && !hasPermission(user, 'admin')) {
    throw new Error('FORBIDDEN')
  }

  const updated = await saveTicket({
    ...existing,
    status: ZEEV_STEPS.in_service,
    assigneeId: existing.assigneeId ?? user.id,
    updatedAt: new Date().toISOString(),
  })

  void notifyTicketEmail('atendimento_iniciado', updated, existing.requester, user.id)
  return updated
}

export async function completeTicketService(ticketId: string, user: User): Promise<Ticket> {
  const existing = await readTicket(ticketId)
  if (existing.status !== ZEEV_STEPS.in_service) throw new Error('INVALID_STATUS')

  const now = new Date().toISOString()
  const updated = await saveTicket({
    ...existing,
    status: ZEEV_STEPS.awaiting_evaluation,
    sla: { ...existing.sla, resolvedAt: now },
    updatedAt: now,
  })

  void notifyTicketEmail('avaliacao_pendente', updated, existing.requester, user.id)
  return updated
}

export async function submitTicketEvaluation(
  payload: SubmitTicketEvaluationPayload,
  user: User,
): Promise<Ticket> {
  const existing = await readTicket(payload.ticketId)
  if (existing.status !== ZEEV_STEPS.awaiting_evaluation) throw new Error('INVALID_STATUS')

  const config = await getAppConfig()
  if (payload.score <= config.npsLowScoreThreshold && !payload.npsJustification) {
    throw new Error('NPS_JUSTIFICATION_REQUIRED')
  }
  if (!payload.metExpectation && !payload.expectation) {
    throw new Error('EXPECTATION_REQUIRED')
  }

  const updated = await saveTicket({
    ...existing,
    evaluation: {
      metExpectation: payload.metExpectation,
      score: payload.score,
      expectation: payload.expectation,
      feedback: payload.feedback,
      npsJustification: payload.npsJustification,
    },
    status: ZEEV_STEPS.completed,
    updatedAt: new Date().toISOString(),
  })

  void notifyTicketEmail('avaliacao_recebida', updated, { email: user.email, name: user.name }, user.id)
  void notifyTicketEmail('ticket_concluido', updated, existing.requester, user.id)
  return updated
}

export async function createTicketTask(payload: CreateTicketTaskPayload, userId: string): Promise<Ticket> {
  const existing = await readTicket(payload.ticketId)
  const now = new Date().toISOString()
  const task = {
    id: randomUUID(),
    description: payload.description,
    assigneeId: payload.assigneeId,
    dueDate: payload.dueDate,
    status: 'pending' as const,
    createdAt: now,
    updatedAt: now,
  }
  return saveTicket({
    ...existing,
    tasks: [...(existing.tasks ?? []), task],
    updatedAt: now,
  })
}

export async function updateTicketTask(payload: UpdateTicketTaskPayload, userId: string): Promise<Ticket> {
  const existing = await readTicket(payload.ticketId)
  const now = new Date().toISOString()
  const tasks = (existing.tasks ?? []).map((t) =>
    t.id === payload.taskId
      ? {
          ...t,
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.assigneeId !== undefined ? { assigneeId: payload.assigneeId ?? undefined } : {}),
          ...(payload.dueDate !== undefined ? { dueDate: payload.dueDate } : {}),
          ...(payload.status !== undefined ? { status: payload.status } : {}),
          updatedAt: now,
        }
      : t,
  )
  if (!tasks.some((t) => t.id === payload.taskId)) throw new Error('TASK_NOT_FOUND')
  return saveTicket({ ...existing, tasks, updatedAt: now })
}

export async function createTicketAppointment(
  payload: CreateTicketAppointmentPayload,
  userId: string,
): Promise<Ticket> {
  const existing = await readTicket(payload.ticketId)
  const totalMinutes = calcMinutesBetween(payload.startTime, payload.endTime)
  if (totalMinutes <= 0) throw new Error('INVALID_TIME_RANGE')

  const appointment = {
    id: randomUUID(),
    date: payload.date,
    startTime: payload.startTime,
    endTime: payload.endTime,
    totalMinutes,
    technicianId: userId,
    origin: 'manual' as const,
    note: payload.note,
  }

  return saveTicket({
    ...existing,
    appointments: [...existing.appointments, appointment],
    updatedAt: new Date().toISOString(),
  })
}

export async function listTicketsFiltered(
  filter: ListTicketsFilterPayload | undefined,
  user: User,
): Promise<Ticket[]> {
  const all = await listAllTickets()
  const queue = filter?.queue ?? 'all'

  if (queue === 'mine') {
    return all.filter(
      (t) =>
        t.requesterUserId === user.id ||
        t.requester.email.toLowerCase() === user.email.toLowerCase(),
    )
  }
  if (queue === 'triage') {
    return all.filter((t) => t.status === ZEEV_STEPS.in_triage)
  }
  if (queue === 'service') {
    return all.filter(
      (t) =>
        (t.status === ZEEV_STEPS.awaiting_service || t.status === ZEEV_STEPS.in_service) &&
        (t.assigneeId === user.id || hasPermission(user, 'admin')),
    )
  }
  if (queue === 'approvals_it') {
    return all.filter((t) => t.status === ZEEV_STEPS.awaiting_it_manager_approval)
  }
  if (queue === 'approvals_app') {
    return all.filter((t) => t.status === ZEEV_STEPS.awaiting_app_manager_approval)
  }
  if (queue === 'cancellation') {
    return all.filter((t) => t.status === ZEEV_STEPS.awaiting_cancellation_approval)
  }

  if (hasPermission(user, 'requester') && !hasPermission(user, 'triage') && user.role === 'member') {
    return all.filter((t) => t.requester.email.toLowerCase() === user.email.toLowerCase())
  }

  return all
}

export async function getTicketReportStats(): Promise<TicketReportStats> {
  const all = await listAllTickets()
  const terminal = new Set<string>([
    ZEEV_STEPS.completed,
    ZEEV_STEPS.cancelled,
    ZEEV_STEPS.triage_rejected,
    ZEEV_STEPS.improvement_rejected_by_it,
    ZEEV_STEPS.improvement_rejected_by_app,
    ZEEV_STEPS.cancellation_rejected,
    ZEEV_STEPS.cancellation_completed,
  ])

  const open = all.filter((t) => !terminal.has(t.status))
  const byType: Record<string, number> = {}
  const byPriority: Record<string, number> = {}
  const byStatus: Record<string, number> = {}

  for (const t of all) {
    byType[t.type] = (byType[t.type] ?? 0) + 1
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1
  }

  const evaluations = all.filter((t) => t.evaluation).map((t) => t.evaluation!.score)
  const averageScore =
    evaluations.length > 0 ? evaluations.reduce((a, b) => a + b, 0) / evaluations.length : null

  return {
    totalOpen: open.length,
    byType,
    byPriority,
    byStatus,
    averageScore,
    evaluationCount: evaluations.length,
  }
}

export function buildCancellationItems(
  items: Array<{ zeevRequestNumber: string; justification?: string }>,
): TicketCancellationItem[] {
  const now = new Date().toISOString()
  return items.map((item) => ({
    id: randomUUID(),
    zeevRequestNumber: item.zeevRequestNumber,
    justification: item.justification,
    status: 'pending' as const,
    processedAt: undefined,
  }))
}
