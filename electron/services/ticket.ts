import { randomUUID } from 'crypto'
import { format } from 'date-fns'
import { calcDeadline, getSlaStatus } from '../../shared/lib/sla'
import type {
  AttachmentFile,
  Appointment,
  CreateTicketPayload,
  Expense,
  ServiceGroup,
  Ticket,
  TicketPriority,
  TicketSource,
  TicketType,
  UserRole,
} from '../../shared/types'
import { buildBlobKey, deleteBlob, getBlobDownloadUrl, uploadBase64Blob } from './blob'
import { getContainer } from './cosmos'
import { notifyDiscord } from './discord'
import { findApplicableSlaRule } from './sla-rule'
import {
  canTransitionTicket,
  findInitialStep,
  getDefaultWorkflow,
  getWorkflowById,
} from './workflow'

const CONTAINER = 'tickets'

export interface CreateTicketInput extends CreateTicketPayload {
  source: TicketSource
  externalId?: string
}

export interface TransitionTicketStepInput {
  ticketId: string
  toStepId: string
  changedBy: string
  role: UserRole
}

export interface CreateTicketExpenseInput {
  ticketId: string
  description: string
  supplier?: string
  quantity: number
  unitValue: number
}

export interface UpdateTicketExpenseInput {
  ticketId: string
  expenseId: string
  description?: string
  supplier?: string
  quantity?: number
  unitValue?: number
}

export interface DeleteTicketExpenseInput {
  ticketId: string
  expenseId: string
}

export interface UploadTicketExpenseAttachmentInput {
  ticketId: string
  expenseId: string
  fileName: string
  mimeType: string
  base64Content: string
  uploadedBy: string
}

export interface DeleteTicketExpenseAttachmentInput {
  ticketId: string
  expenseId: string
  attachmentId: string
}

export interface UploadTicketAttachmentInput {
  ticketId: string
  fileName: string
  mimeType: string
  base64Content: string
  uploadedBy: string
}

export interface DeleteTicketAttachmentInput {
  ticketId: string
  attachmentId: string
}

function normalizeTicketCollections(ticket: Ticket): Ticket {
  return {
    ...ticket,
    expenses: (ticket.expenses ?? []).map((expense) => ({
      ...expense,
      receiptFiles: expense.receiptFiles ?? [],
      updatedAt: expense.updatedAt ?? expense.createdAt,
    })),
    attachments: ticket.attachments ?? [],
  }
}

async function buildTicket(input: CreateTicketInput): Promise<Ticket> {
  const now = new Date().toISOString()
  const workflow = await getDefaultWorkflow()
  if (!workflow) {
    throw new Error('WORKFLOW_NOT_CONFIGURED')
  }

  const initialStep = findInitialStep(workflow)

  const matchedRule = await findApplicableSlaRule(input.priority, input.serviceGroup)
  const deadlineHours = initialStep.slaHours ?? matchedRule?.deadlineHours
  const deadline = deadlineHours ? calcDeadline(now, deadlineHours) : undefined
  const slaStatus = deadline ? getSlaStatus(now, deadline) : 'ok'

  return {
    id: randomUUID(),
    externalId: input.externalId,
    source: input.source,
    title: input.title,
    description: input.description,
    requester: {
      name: input.requesterName,
      email: input.requesterEmail.toLowerCase(),
      costCenter: input.costCenter,
    },
    type: input.type as TicketType,
    priority: input.priority as TicketPriority,
    serviceGroup: input.serviceGroup as ServiceGroup,
    status: initialStep.id,
    workflowId: workflow.id,
    assigneeId: initialStep.defaultAssigneeId,
    appointments: [],
    expenses: [],
    attachments: [],
    workflowHistory: [],
    sla: {
      deadline,
      firstContactAt: deadline ? now : undefined,
      status: slaStatus,
    },
    createdAt: now,
    updatedAt: now,
  }
}

function withComputedSla(ticket: Ticket): Ticket {
  const normalized = normalizeTicketCollections(ticket)

  if (!normalized.sla.deadline) {
    return {
      ...normalized,
      sla: {
        ...normalized.sla,
        status: 'ok',
      },
    }
  }

  const baseDate = normalized.sla.firstContactAt ?? normalized.createdAt

  return {
    ...normalized,
    sla: {
      ...normalized.sla,
      status: getSlaStatus(baseDate, normalized.sla.deadline),
    },
  }
}

function ensureExpense(ticket: Ticket, expenseId: string): Expense {
  const expense = (ticket.expenses ?? []).find((item) => item.id === expenseId)
  if (!expense) throw new Error('EXPENSE_NOT_FOUND')
  return expense
}

function ensureAttachment(attachments: AttachmentFile[], attachmentId: string): AttachmentFile {
  const attachment = attachments.find((item) => item.id === attachmentId)
  if (!attachment) throw new Error('ATTACHMENT_NOT_FOUND')
  return attachment
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const container = await getContainer(CONTAINER)
  const ticket = await buildTicket(input)
  const { resource } = await container.items.create<Ticket>(ticket)
  const created = withComputedSla(resource as Ticket)

  void notifyDiscord('ticket_created', { ticket: created })
    .catch((error) => {
      console.error('[discord] notify ticket_created failed', {
        ticketId: created.id,
        error: error instanceof Error ? error.message : String(error),
      })
    })

  return created
}

export async function listTickets(): Promise<Ticket[]> {
  const container = await getContainer(CONTAINER)
  const { resources } = await container.items
    .query<Ticket>('SELECT * FROM c ORDER BY c.createdAt DESC')
    .fetchAll()
  return resources.map(withComputedSla)
}

export async function getTicketById(id: string): Promise<Ticket | null> {
  const container = await getContainer(CONTAINER)
  try {
    const { resource } = await container.item(id, id).read<Ticket>()
    return resource ? withComputedSla(resource) : null
  } catch {
    return null
  }
}

export async function transitionTicketStep(input: TransitionTicketStepInput): Promise<Ticket> {
  if (input.role !== 'manager' && input.role !== 'admin') {
    throw new Error('FORBIDDEN')
  }

  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.ticketId, input.ticketId).read<Ticket>()
  if (!existing) {
    throw new Error('TICKET_NOT_FOUND')
  }

  const workflow = await getWorkflowById(existing.workflowId)
  if (!workflow) {
    throw new Error('WORKFLOW_NOT_FOUND')
  }

  const toStep = workflow.steps.find((step) => step.id === input.toStepId)
  if (!toStep) {
    throw new Error('WORKFLOW_STEP_NOT_FOUND')
  }

  const canTransition = canTransitionTicket(
    workflow,
    existing.status,
    input.toStepId,
    existing as unknown as Record<string, unknown>,
  )

  if (!canTransition) {
    throw new Error('TRANSITION_NOT_ALLOWED')
  }

  const now = new Date().toISOString()
  const shouldUpdateSla = toStep.slaHours !== undefined
  const newDeadline = shouldUpdateSla ? calcDeadline(now, toStep.slaHours as number) : existing.sla.deadline

  const updated: Ticket = {
    ...existing,
    status: toStep.id,
    assigneeId: toStep.defaultAssigneeId ?? existing.assigneeId,
    workflowHistory: [
      ...(existing.workflowHistory ?? []),
      {
        id: randomUUID(),
        fromStepId: existing.status,
        toStepId: toStep.id,
        changedBy: input.changedBy,
        changedAt: now,
      },
    ],
    sla: {
      ...existing.sla,
      deadline: newDeadline,
      firstContactAt: shouldUpdateSla ? now : existing.sla.firstContactAt,
      status: newDeadline
        ? getSlaStatus(shouldUpdateSla ? now : existing.sla.firstContactAt ?? existing.createdAt, newDeadline)
        : 'ok',
    },
    updatedAt: now,
  }

  const { resource } = await container.item(input.ticketId, input.ticketId).replace<Ticket>(updated)
  const transitioned = withComputedSla(resource as Ticket)

  void notifyDiscord('ticket_status_changed', {
    ticket: transitioned,
    previousTicket: existing,
  }).catch((error) => {
    console.error('[discord] notify ticket_status_changed failed', {
      ticketId: transitioned.id,
      error: error instanceof Error ? error.message : String(error),
    })
  })

  if (existing.assigneeId !== transitioned.assigneeId && transitioned.assigneeId) {
    void notifyDiscord('ticket_assigned', {
      ticket: transitioned,
      previousTicket: existing,
    }).catch((error) => {
      console.error('[discord] notify ticket_assigned failed', {
        ticketId: transitioned.id,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  if (existing.sla.status !== transitioned.sla.status && transitioned.sla.status === 'warning') {
    void notifyDiscord('ticket_sla_warning', {
      ticket: transitioned,
      previousTicket: existing,
    }).catch((error) => {
      console.error('[discord] notify ticket_sla_warning failed', {
        ticketId: transitioned.id,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  if (existing.sla.status !== transitioned.sla.status && transitioned.sla.status === 'overdue') {
    void notifyDiscord('ticket_sla_overdue', {
      ticket: transitioned,
      previousTicket: existing,
    }).catch((error) => {
      console.error('[discord] notify ticket_sla_overdue failed', {
        ticketId: transitioned.id,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  const closedByStatusId = transitioned.status.toLowerCase().includes('done')
    || transitioned.status.toLowerCase().includes('closed')
    || transitioned.status.toLowerCase().includes('conclu')

  if (closedByStatusId) {
    void notifyDiscord('ticket_closed', {
      ticket: transitioned,
      previousTicket: existing,
    }).catch((error) => {
      console.error('[discord] notify ticket_closed failed', {
        ticketId: transitioned.id,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  return transitioned
}

export async function appendTimerAppointmentToTicket(input: {
  ticketId: string
  technicianId: string
  startedAt: string
  endedAt: string
  totalSeconds: number
}): Promise<Appointment> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.ticketId, input.ticketId).read<Ticket>()
  if (!existing) {
    throw new Error('TICKET_NOT_FOUND')
  }

  const startDate = new Date(input.startedAt)
  const endDate = new Date(input.endedAt)
  const totalMinutes = Math.max(0, Math.round(input.totalSeconds / 60))

  const appointment: Appointment = {
    id: randomUUID(),
    date: format(endDate, 'yyyy-MM-dd'),
    startTime: format(startDate, 'HH:mm'),
    endTime: format(endDate, 'HH:mm'),
    totalMinutes,
    technicianId: input.technicianId,
    origin: 'timer',
  }

  const updated: Ticket = {
    ...existing,
    appointments: [...(existing.appointments ?? []), appointment],
    updatedAt: new Date().toISOString(),
  }

  await container.item(input.ticketId, input.ticketId).replace<Ticket>(updated)
  return appointment
}

export async function createTicketExpense(input: CreateTicketExpenseInput): Promise<Ticket> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.ticketId, input.ticketId).read<Ticket>()
  if (!existing) throw new Error('TICKET_NOT_FOUND')

  const base = normalizeTicketCollections(existing)
  const now = new Date().toISOString()
  const expense: Expense = {
    id: randomUUID(),
    description: input.description,
    supplier: input.supplier,
    quantity: input.quantity,
    unitValue: input.unitValue,
    totalValue: Number((input.quantity * input.unitValue).toFixed(2)),
    receiptFiles: [],
    createdAt: now,
    updatedAt: now,
  }

  const updated: Ticket = {
    ...base,
    expenses: [...base.expenses, expense],
    updatedAt: now,
  }

  const { resource } = await container.item(base.id, base.id).replace<Ticket>(updated)
  return withComputedSla(resource as Ticket)
}

export async function updateTicketExpense(input: UpdateTicketExpenseInput): Promise<Ticket> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.ticketId, input.ticketId).read<Ticket>()
  if (!existing) throw new Error('TICKET_NOT_FOUND')

  const base = normalizeTicketCollections(existing)
  ensureExpense(base, input.expenseId)
  const now = new Date().toISOString()

  const updatedExpenses = base.expenses.map((expense) => {
    if (expense.id !== input.expenseId) return expense
    const quantity = input.quantity ?? expense.quantity
    const unitValue = input.unitValue ?? expense.unitValue
    return {
      ...expense,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.supplier !== undefined ? { supplier: input.supplier } : {}),
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.unitValue !== undefined ? { unitValue: input.unitValue } : {}),
      totalValue: Number((quantity * unitValue).toFixed(2)),
      updatedAt: now,
    }
  })

  const updated: Ticket = {
    ...base,
    expenses: updatedExpenses,
    updatedAt: now,
  }

  const { resource } = await container.item(base.id, base.id).replace<Ticket>(updated)
  return withComputedSla(resource as Ticket)
}

export async function deleteTicketExpense(input: DeleteTicketExpenseInput): Promise<Ticket> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.ticketId, input.ticketId).read<Ticket>()
  if (!existing) throw new Error('TICKET_NOT_FOUND')

  const base = normalizeTicketCollections(existing)
  const expense = ensureExpense(base, input.expenseId)

  await Promise.all(expense.receiptFiles.map((file) => deleteBlob(file.blobKey)))

  const updated: Ticket = {
    ...base,
    expenses: base.expenses.filter((item) => item.id !== input.expenseId),
    updatedAt: new Date().toISOString(),
  }

  const { resource } = await container.item(base.id, base.id).replace<Ticket>(updated)
  return withComputedSla(resource as Ticket)
}

export async function uploadTicketExpenseAttachment(
  input: UploadTicketExpenseAttachmentInput,
): Promise<Ticket> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.ticketId, input.ticketId).read<Ticket>()
  if (!existing) throw new Error('TICKET_NOT_FOUND')

  const base = normalizeTicketCollections(existing)
  ensureExpense(base, input.expenseId)
  const attachmentId = randomUUID()

  const uploaded = await uploadBase64Blob({
    blobKey: buildBlobKey({
      entityType: 'ticket',
      entityId: base.id,
      scope: 'expense',
      expenseId: input.expenseId,
      attachmentId,
      fileName: input.fileName,
    }),
    fileName: input.fileName,
    mimeType: input.mimeType,
    base64Content: input.base64Content,
  })

  const now = new Date().toISOString()
  const attachment: AttachmentFile = {
    id: attachmentId,
    fileName: uploaded.fileName,
    blobKey: uploaded.blobKey,
    mimeType: uploaded.mimeType,
    size: uploaded.size,
    uploadedBy: input.uploadedBy,
    uploadedAt: now,
  }

  const updated: Ticket = {
    ...base,
    expenses: base.expenses.map((expense) =>
      expense.id === input.expenseId
        ? {
            ...expense,
            receiptFiles: [...expense.receiptFiles, attachment],
            updatedAt: now,
          }
        : expense,
    ),
    updatedAt: now,
  }

  const { resource } = await container.item(base.id, base.id).replace<Ticket>(updated)
  return withComputedSla(resource as Ticket)
}

export async function deleteTicketExpenseAttachment(
  input: DeleteTicketExpenseAttachmentInput,
): Promise<Ticket> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.ticketId, input.ticketId).read<Ticket>()
  if (!existing) throw new Error('TICKET_NOT_FOUND')

  const base = normalizeTicketCollections(existing)
  const expense = ensureExpense(base, input.expenseId)
  const attachment = ensureAttachment(expense.receiptFiles, input.attachmentId)

  await deleteBlob(attachment.blobKey)

  const now = new Date().toISOString()
  const updated: Ticket = {
    ...base,
    expenses: base.expenses.map((item) =>
      item.id === input.expenseId
        ? {
            ...item,
            receiptFiles: item.receiptFiles.filter((file) => file.id !== input.attachmentId),
            updatedAt: now,
          }
        : item,
    ),
    updatedAt: now,
  }

  const { resource } = await container.item(base.id, base.id).replace<Ticket>(updated)
  return withComputedSla(resource as Ticket)
}

export async function uploadTicketAttachment(input: UploadTicketAttachmentInput): Promise<Ticket> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.ticketId, input.ticketId).read<Ticket>()
  if (!existing) throw new Error('TICKET_NOT_FOUND')

  const base = normalizeTicketCollections(existing)
  const attachmentId = randomUUID()

  const uploaded = await uploadBase64Blob({
    blobKey: buildBlobKey({
      entityType: 'ticket',
      entityId: base.id,
      scope: 'entity',
      attachmentId,
      fileName: input.fileName,
    }),
    fileName: input.fileName,
    mimeType: input.mimeType,
    base64Content: input.base64Content,
  })

  const now = new Date().toISOString()
  const attachment: AttachmentFile = {
    id: attachmentId,
    fileName: uploaded.fileName,
    blobKey: uploaded.blobKey,
    mimeType: uploaded.mimeType,
    size: uploaded.size,
    uploadedBy: input.uploadedBy,
    uploadedAt: now,
  }

  const updated: Ticket = {
    ...base,
    attachments: [...base.attachments, attachment],
    updatedAt: now,
  }

  const { resource } = await container.item(base.id, base.id).replace<Ticket>(updated)
  return withComputedSla(resource as Ticket)
}

export async function deleteTicketAttachment(input: DeleteTicketAttachmentInput): Promise<Ticket> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.ticketId, input.ticketId).read<Ticket>()
  if (!existing) throw new Error('TICKET_NOT_FOUND')

  const base = normalizeTicketCollections(existing)
  const attachment = ensureAttachment(base.attachments, input.attachmentId)
  await deleteBlob(attachment.blobKey)

  const updated: Ticket = {
    ...base,
    attachments: base.attachments.filter((item) => item.id !== input.attachmentId),
    updatedAt: new Date().toISOString(),
  }

  const { resource } = await container.item(base.id, base.id).replace<Ticket>(updated)
  return withComputedSla(resource as Ticket)
}

export async function listTicketAttachments(ticketId: string): Promise<AttachmentFile[]> {
  const ticket = await getTicketById(ticketId)
  if (!ticket) throw new Error('TICKET_NOT_FOUND')
  return ticket.attachments ?? []
}

export async function getAttachmentDownloadUrl(blobKey: string): Promise<string> {
  return getBlobDownloadUrl(blobKey)
}
