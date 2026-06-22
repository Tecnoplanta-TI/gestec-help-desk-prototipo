import { ipcMain } from 'electron'
import { z } from 'zod'
import { resolveAuthenticatedUser } from '../services/session-user'
import { sanitizeCreateTicketPayload } from '../../shared/lib/ticket-payload'
import type { CreateTicketPayload } from '../../shared/types'
import {
  createTicket,
  createTicketExpense,
  deleteTicketAttachment,
  deleteTicketExpense,
  deleteTicketExpenseAttachment,
  getAttachmentDownloadUrl,
  getTicketById,
  listTicketAttachments,
  listTickets,
  transitionTicketStep,
  updateTicketExpense,
  uploadTicketAttachment,
  uploadTicketExpenseAttachment,
} from '../services/ticket'

function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((val) => (val === '' || val === null ? undefined : val), schema)
}

const CreateTicketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(3).max(4000),
  requesterName: z.string().min(2).max(120),
  requesterEmail: z.string().email(),
  requesterUserId: emptyToUndefined(z.string().uuid().optional()),
  costCenter: z.string().min(1).max(50),
  type: z.enum(['incident', 'service_interruption', 'improvement', 'request', 'cancellation']),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']),
  serviceGroup: z.enum([
    'access_accounts',
    'acquisitions',
    'dashboards',
    'emails',
    'gestec',
    'printers',
    'maintenance_upgrade',
    'software',
    'network_internet',
    'erp',
    'process_platform',
    'other',
  ]),
  service: z.enum(['infrastructure', 'system']).optional(),
  unavailableSystem: z
    .enum(['3cx', 'ecommerce', 'insoft', 'kinghost', 'other', 'pdv_siger', 'siger'])
    .optional(),
  inoperableInfrastructure: z
    .enum(['internet', 'other', 'network', 'time_clocks', 'local_server', 'ts', 'vm', 'vpn'])
    .optional(),
  applicationProcess: z.string().max(200).optional(),
  improvementAcknowledged: z.boolean().optional(),
  appManagerId: emptyToUndefined(z.string().uuid().optional()),
  assetCode: z.string().max(100).optional(),
  supportNotes: z.string().max(4000).optional(),
  level: z.enum(['N1', 'N2', 'N3']).optional(),
  downtimeMinutes: z.number().int().nonnegative().optional(),
  cancellationItems: z
    .array(
      z.object({
        zeevRequestNumber: z.string().min(1).max(50),
        justification: z.string().max(2000).optional(),
      }),
    )
    .optional(),
  cancellationApproverId: emptyToUndefined(z.string().uuid().optional()),
  directCancellation: z.boolean().optional(),
})

const CreateTicketExpenseSchema = z.object({
  ticketId: z.string().uuid(),
  description: z.string().min(1).max(500),
  supplier: z.string().max(200).optional(),
  quantity: z.number().positive(),
  unitValue: z.number().nonnegative(),
})

const UpdateTicketExpenseSchema = z.object({
  ticketId: z.string().uuid(),
  expenseId: z.string().uuid(),
  description: z.string().min(1).max(500).optional(),
  supplier: z.string().max(200).optional(),
  quantity: z.number().positive().optional(),
  unitValue: z.number().nonnegative().optional(),
})

const DeleteTicketExpenseSchema = z.object({
  ticketId: z.string().uuid(),
  expenseId: z.string().uuid(),
})

const UploadTicketExpenseAttachmentSchema = z.object({
  ticketId: z.string().uuid(),
  expenseId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  base64Content: z.string().min(1),
})

const DeleteTicketExpenseAttachmentSchema = z.object({
  ticketId: z.string().uuid(),
  expenseId: z.string().uuid(),
  attachmentId: z.string().uuid(),
})

const UploadTicketAttachmentSchema = z.object({
  ticketId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  base64Content: z.string().min(1),
})

const DeleteTicketAttachmentSchema = z.object({
  ticketId: z.string().uuid(),
  attachmentId: z.string().uuid(),
})

function ipcError(code: string, message?: string): never {
  throw Object.assign(new Error(message ?? code), { code })
}

async function requireAuthenticatedUser() {
  const user = await resolveAuthenticatedUser()
  if (!user) ipcError('UNAUTHORIZED')
  return user
}

function mapTicketServiceError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('WORKFLOW_NOT_CONFIGURED')) ipcError('WORKFLOW_NOT_CONFIGURED')
  if (message.includes('WORKFLOW_NOT_FOUND')) ipcError('WORKFLOW_NOT_FOUND')
  if (message.includes('WORKFLOW_STEP_NOT_FOUND')) ipcError('WORKFLOW_STEP_NOT_FOUND')
  if (message.includes('TRANSITION_NOT_ALLOWED')) ipcError('TRANSITION_NOT_ALLOWED')
  if (message.includes('TICKET_NOT_FOUND')) ipcError('TICKET_NOT_FOUND')
  if (message.includes('EXPENSE_NOT_FOUND')) ipcError('EXPENSE_NOT_FOUND')
  if (message.includes('ATTACHMENT_NOT_FOUND')) ipcError('ATTACHMENT_NOT_FOUND')
  if (message.includes('UNSUPPORTED_FILE_TYPE')) ipcError('UNSUPPORTED_FILE_TYPE')
  if (message.includes('FILE_TOO_LARGE')) ipcError('FILE_TOO_LARGE')
  if (message.includes('BLOB_NOT_CONFIGURED')) ipcError('BLOB_NOT_CONFIGURED')
  if (message.includes('FORBIDDEN')) ipcError('FORBIDDEN')
  throw error
}

export function registerTicketHandlers(): void {
  ipcMain.handle('ticket:list', async () => {
    await requireAuthenticatedUser()
    return listTickets()
  })

  ipcMain.handle('ticket:get-by-id', async (_event, ticketId: string) => {
    await requireAuthenticatedUser()
    if (!z.string().uuid().safeParse(ticketId).success) ipcError('INVALID_INPUT')
    const ticket = await getTicketById(ticketId)
    if (!ticket) ipcError('TICKET_NOT_FOUND')
    return ticket
  })

  ipcMain.handle('ticket:create', async (_event, payload: unknown) => {
    const user = await requireAuthenticatedUser()
    const sanitized =
      payload && typeof payload === 'object'
        ? sanitizeCreateTicketPayload(payload as CreateTicketPayload)
        : payload
    const parsed = CreateTicketSchema.safeParse(sanitized)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await createTicket(
        {
          ...parsed.data,
          source: 'manual',
          requesterUserId: parsed.data.requesterUserId ?? user.id,
        },
        user.id,
      )
    } catch (error) {
      mapTicketServiceError(error)
    }
  })

  ipcMain.handle('ticket:transition-step', async (_event, payload: unknown) => {
    const user = await requireAuthenticatedUser()

    const parsed = z
      .object({
        ticketId: z.string().uuid(),
        toStepId: z.string().uuid(),
      })
      .safeParse(payload)

    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await transitionTicketStep({
        ticketId: parsed.data.ticketId,
        toStepId: parsed.data.toStepId,
        changedBy: user.id,
        role: user.role,
      })
    } catch (error) {
      mapTicketServiceError(error)
    }
  })

  ipcMain.handle('ticket:create-expense', async (_event, payload: unknown) => {
    await requireAuthenticatedUser()
    const parsed = CreateTicketExpenseSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await createTicketExpense(parsed.data)
    } catch (error) {
      mapTicketServiceError(error)
    }
  })

  ipcMain.handle('ticket:update-expense', async (_event, payload: unknown) => {
    await requireAuthenticatedUser()
    const parsed = UpdateTicketExpenseSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await updateTicketExpense(parsed.data)
    } catch (error) {
      mapTicketServiceError(error)
    }
  })

  ipcMain.handle('ticket:delete-expense', async (_event, payload: unknown) => {
    await requireAuthenticatedUser()
    const parsed = DeleteTicketExpenseSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await deleteTicketExpense(parsed.data)
    } catch (error) {
      mapTicketServiceError(error)
    }
  })

  ipcMain.handle('ticket:upload-expense-attachment', async (_event, payload: unknown) => {
    const user = await requireAuthenticatedUser()
    const parsed = UploadTicketExpenseAttachmentSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await uploadTicketExpenseAttachment({
        ...parsed.data,
        uploadedBy: user.id,
      })
    } catch (error) {
      mapTicketServiceError(error)
    }
  })

  ipcMain.handle('ticket:delete-expense-attachment', async (_event, payload: unknown) => {
    await requireAuthenticatedUser()
    const parsed = DeleteTicketExpenseAttachmentSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await deleteTicketExpenseAttachment(parsed.data)
    } catch (error) {
      mapTicketServiceError(error)
    }
  })

  ipcMain.handle('ticket:list-attachments', async (_event, ticketId: unknown) => {
    await requireAuthenticatedUser()
    const parsed = z.string().uuid().safeParse(ticketId)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await listTicketAttachments(parsed.data)
    } catch (error) {
      mapTicketServiceError(error)
    }
  })

  ipcMain.handle('ticket:upload-attachment', async (_event, payload: unknown) => {
    const user = await requireAuthenticatedUser()
    const parsed = UploadTicketAttachmentSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await uploadTicketAttachment({
        ...parsed.data,
        uploadedBy: user.id,
      })
    } catch (error) {
      mapTicketServiceError(error)
    }
  })

  ipcMain.handle('ticket:delete-attachment', async (_event, payload: unknown) => {
    await requireAuthenticatedUser()
    const parsed = DeleteTicketAttachmentSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await deleteTicketAttachment(parsed.data)
    } catch (error) {
      mapTicketServiceError(error)
    }
  })

  ipcMain.handle('attachment:get-download-url', async (_event, payload: unknown) => {
    await requireAuthenticatedUser()
    const parsed = z.object({ blobKey: z.string().min(1) }).safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await getAttachmentDownloadUrl(parsed.data.blobKey)
    } catch (error) {
      mapTicketServiceError(error)
    }
  })
}
