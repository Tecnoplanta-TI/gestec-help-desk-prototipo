import { ipcMain } from 'electron'
import { z } from 'zod'
import { resolveAuthenticatedUser } from '../services/session-user'
import {
  createCostCenter,
  getAppConfig,
  listCostCenters,
  updateAppConfig,
  updateCostCenter,
} from '../services/app-config'
import { listAuditLogs } from '../services/audit'
import {
  addTicketComment,
  approveTicket,
  approveTicketCompletion,
  completeTicketService,
  createTicketAppointment,
  createTicketTask,
  deleteTicketAppointment,
  getTicketReportStats,
  listTicketsFiltered,
  startTicketService,
  submitTicketEvaluation,
  triageTicket,
  updateServiceTicket,
  updateTicket,
  updateTicketTask,
} from '../services/ticket-zeev'

function ipcError(code: string, message?: string): never {
  throw Object.assign(new Error(message ?? code), { code })
}

async function requireUser() {
  const user = await resolveAuthenticatedUser()
  if (!user) ipcError('UNAUTHORIZED')
  return user
}

const ApproveSchema = z.object({
  ticketId: z.string().uuid(),
  approved: z.boolean(),
  justification: z.string().max(2000).optional(),
  stage: z.enum(['it_manager', 'app_manager', 'cancellation']),
})

const TriageSchema = z.object({
  ticketId: z.string().uuid(),
  decision: z.enum(['approve', 'reject', 'adjustment']),
  assigneeId: z.string().uuid().optional(),
  justification: z.string().max(2000).optional(),
  costCenter: z.string().min(1).max(50).optional(),
  type: z
    .enum(['incident', 'service_interruption', 'improvement', 'request', 'cancellation'])
    .optional(),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
  level: z.enum(['N1', 'N2', 'N3']).optional(),
  serviceGroup: z
    .enum([
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
    ])
    .optional(),
})

const EvaluationSchema = z.object({
  ticketId: z.string().uuid(),
  metExpectation: z.boolean(),
  score: z.number().int().min(1).max(10),
  expectation: z.string().max(2000).optional(),
  feedback: z.string().max(4000).optional(),
  npsJustification: z.string().max(2000).optional(),
})

export function registerZeevHandlers(): void {
  ipcMain.handle('ticket:list-filtered', async (_event, filter: unknown) => {
    const user = await requireUser()
    const parsed = z
      .object({
        queue: z
          .enum([
            'all',
            'mine',
            'triage',
            'service',
            'completion',
            'approvals_it',
            'approvals_app',
            'cancellation',
          ])
          .optional(),
      })
      .safeParse(filter ?? {})
    if (!parsed.success) ipcError('INVALID_INPUT')
    return listTicketsFiltered(parsed.data, user)
  })

  ipcMain.handle('ticket:update', async (_event, payload: unknown) => {
    const user = await requireUser()
    const parsed = z
      .object({
        ticketId: z.string().uuid(),
        title: z.string().min(3).max(200).optional(),
        description: z.string().min(3).max(4000).optional(),
        priority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
        expectedUpdatedAt: z.string().optional(),
      })
      .safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    try {
      return await updateTicket(parsed.data, user.id)
    } catch (e) {
      if (e instanceof Error && e.message === 'FORBIDDEN') ipcError('FORBIDDEN')
      throw e
    }
  })

  ipcMain.handle('ticket:approve', async (_event, payload: unknown) => {
    const user = await requireUser()
    const parsed = ApproveSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    try {
      return await approveTicket(parsed.data, user)
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === 'FORBIDDEN') ipcError('FORBIDDEN')
        if (e.message === 'JUSTIFICATION_REQUIRED') ipcError('JUSTIFICATION_REQUIRED')
      }
      throw e
    }
  })

  ipcMain.handle('ticket:triage', async (_event, payload: unknown) => {
    const user = await requireUser()
    const parsed = TriageSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    try {
      return await triageTicket(parsed.data, user)
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === 'FORBIDDEN') ipcError('FORBIDDEN')
        if (e.message === 'ASSIGNEE_REQUIRED') ipcError('ASSIGNEE_REQUIRED')
      }
      throw e
    }
  })

  ipcMain.handle('ticket:start-service', async (_event, ticketId: unknown) => {
    const user = await requireUser()
    if (!z.string().uuid().safeParse(ticketId).success) ipcError('INVALID_INPUT')
    try {
      return await startTicketService(ticketId as string, user)
    } catch (e) {
      if (e instanceof Error && e.message === 'FORBIDDEN') ipcError('FORBIDDEN')
      throw e
    }
  })

  ipcMain.handle('ticket:complete-service', async (_event, payload: unknown) => {
    const user = await requireUser()
    const parsed = z
      .object({
        ticketId: z.string().uuid(),
        resolutionSummary: z.string().max(5000).optional(),
        deliveredEquipment: z
          .array(
            z.object({
              id: z.string().uuid(),
              assetId: z.string().max(100),
              description: z.string().max(500),
            }),
          )
          .optional(),
      })
      .safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    try {
      return await completeTicketService(parsed.data, user)
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === 'FORBIDDEN') ipcError('FORBIDDEN')
        if (e.message === 'RESOLUTION_REQUIRED') ipcError('RESOLUTION_REQUIRED')
        if (e.message === 'SERVICE_DUE_DATE_REQUIRED') ipcError('SERVICE_DUE_DATE_REQUIRED')
      }
      throw e
    }
  })

  ipcMain.handle('ticket:update-service', async (_event, payload: unknown) => {
    const user = await requireUser()
    const parsed = z
      .object({
        ticketId: z.string().uuid(),
        costCenter: z.string().min(1).max(50).optional(),
        priority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
        level: z.enum(['N1', 'N2', 'N3']).optional(),
        serviceGroup: z
          .enum([
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
          ])
          .optional(),
        serviceDueDate: z.string().optional(),
        additionalAssigneeId: z.string().uuid().nullable().optional(),
        supportNotes: z.string().max(5000).optional(),
        deliveredEquipment: z
          .array(
            z.object({
              id: z.string().uuid(),
              assetId: z.string().max(100),
              description: z.string().max(500),
            }),
          )
          .optional(),
        createZeevUser: z.boolean().optional(),
        createEmail: z.boolean().optional(),
        facilitatorChecklist: z.string().max(200).optional(),
        securitySealChanged: z.boolean().optional(),
        securitySealCode: z.string().max(100).optional(),
        newSecuritySealCode: z.string().max(100).optional(),
      })
      .safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    try {
      return await updateServiceTicket(parsed.data, user)
    } catch (e) {
      if (e instanceof Error && e.message === 'FORBIDDEN') ipcError('FORBIDDEN')
      throw e
    }
  })

  ipcMain.handle('ticket:approve-completion', async (_event, payload: unknown) => {
    const user = await requireUser()
    const parsed = z
      .object({
        ticketId: z.string().uuid(),
        approved: z.boolean(),
        justification: z.string().max(2000).optional(),
      })
      .safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    try {
      return await approveTicketCompletion(parsed.data, user)
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === 'FORBIDDEN') ipcError('FORBIDDEN')
        if (e.message === 'JUSTIFICATION_REQUIRED') ipcError('JUSTIFICATION_REQUIRED')
      }
      throw e
    }
  })

  ipcMain.handle('ticket:submit-evaluation', async (_event, payload: unknown) => {
    const user = await requireUser()
    const parsed = EvaluationSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    try {
      return await submitTicketEvaluation(parsed.data, user)
    } catch (e) {
      if (e instanceof Error && e.message.includes('REQUIRED')) ipcError(e.message)
      throw e
    }
  })

  ipcMain.handle('ticket:create-task', async (_event, payload: unknown) => {
    const user = await requireUser()
    const parsed = z
      .object({
        ticketId: z.string().uuid(),
        description: z.string().min(1).max(2000),
        assigneeId: z.string().uuid().optional(),
        dueDate: z.string().min(1),
      })
      .safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    return createTicketTask(parsed.data, user.id)
  })

  ipcMain.handle('ticket:update-task', async (_event, payload: unknown) => {
    const user = await requireUser()
    const parsed = z
      .object({
        ticketId: z.string().uuid(),
        taskId: z.string().uuid(),
        description: z.string().min(1).max(2000).optional(),
        assigneeId: z.string().uuid().nullable().optional(),
        dueDate: z.string().optional(),
        status: z.enum(['pending', 'done', 'cancelled']).optional(),
      })
      .safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    return updateTicketTask(parsed.data, user.id)
  })

  ipcMain.handle('ticket:create-appointment', async (_event, payload: unknown) => {
    const user = await requireUser()
    const parsed = z
      .object({
        ticketId: z.string().uuid(),
        date: z.string().min(1),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        note: z.string().max(2000).optional(),
        technicianId: z.string().uuid().optional(),
      })
      .safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    try {
      return await createTicketAppointment(parsed.data, user.id)
    } catch (e) {
      if (e instanceof Error && e.message === 'INVALID_TIME_RANGE') ipcError('INVALID_TIME_RANGE')
      throw e
    }
  })

  ipcMain.handle('ticket:delete-appointment', async (_event, payload: unknown) => {
    const user = await requireUser()
    const parsed = z
      .object({
        ticketId: z.string().uuid(),
        appointmentId: z.string().uuid(),
      })
      .safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    return deleteTicketAppointment(parsed.data, user.id)
  })

  ipcMain.handle('ticket:add-comment', async (_event, payload: unknown) => {
    const user = await requireUser()
    const parsed = z
      .object({
        ticketId: z.string().uuid(),
        body: z.string().min(1).max(2000),
        isInternal: z.boolean().optional(),
      })
      .safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    try {
      return await addTicketComment(parsed.data, user.id)
    } catch (e) {
      if (e instanceof Error && e.message === 'COMMENT_REQUIRED') ipcError('COMMENT_REQUIRED')
      throw e
    }
  })

  ipcMain.handle('audit:list', async (_event, entityId: unknown) => {
    await requireUser()
    if (!z.string().uuid().safeParse(entityId).success) ipcError('INVALID_INPUT')
    return listAuditLogs(entityId as string)
  })

  ipcMain.handle('cost-center:list', async () => {
    await requireUser()
    return listCostCenters()
  })

  ipcMain.handle('cost-center:create', async (_event, payload: unknown) => {
    const user = await requireUser()
    if (user.role !== 'admin') ipcError('FORBIDDEN')
    const parsed = z.object({ code: z.string().min(1), name: z.string().min(1) }).safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    return createCostCenter(parsed.data)
  })

  ipcMain.handle('cost-center:update', async (_event, payload: unknown) => {
    const user = await requireUser()
    if (user.role !== 'admin') ipcError('FORBIDDEN')
    const parsed = z
      .object({
        id: z.string().uuid(),
        code: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        active: z.boolean().optional(),
      })
      .safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    return updateCostCenter(parsed.data)
  })

  ipcMain.handle('app-config:get', async () => {
    await requireUser()
    return getAppConfig()
  })

  ipcMain.handle('app-config:update', async (_event, payload: unknown) => {
    const user = await requireUser()
    if (user.role !== 'admin') ipcError('FORBIDDEN')
    return updateAppConfig(payload as Record<string, unknown>)
  })

  ipcMain.handle('reports:ticket-stats', async () => {
    await requireUser()
    return getTicketReportStats()
  })
}
