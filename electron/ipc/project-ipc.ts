import { ipcMain } from 'electron'
import { z } from 'zod'
import { resolveAuthenticatedUser } from '../services/session-user'
import {
  createProject,
  createProjectExpense,
  createProjectTask,
  createProjectTaskAppointment,
  deleteProject,
  deleteProjectAttachment,
  deleteProjectExpense,
  deleteProjectExpenseAttachment,
  deleteProjectTask,
  deleteProjectTaskAppointment,
  getProjectById,
  isTaskAccessibleByUser,
  listProjectAttachments,
  listProjects,
  updateProject,
  updateProjectExpense,
  updateProjectTask,
  updateProjectTaskAppointment,
  uploadProjectAttachment,
  uploadProjectExpenseAttachment,
} from '../services/project'

const TimeSchema = z.string().regex(/^\d{2}:\d{2}$/)
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const CreateProjectSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().max(4000).optional(),
  costCenter: z.string().min(1).max(100),
  hourlyRate: z.number().positive(),
})

const UpdateProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(200).optional(),
  description: z.string().max(4000).optional(),
  costCenter: z.string().min(1).max(100).optional(),
  hourlyRate: z.number().positive().optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
})

const CreateProjectTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional(),
  assigneeId: z.string().uuid().optional(),
  expectedProjectUpdatedAt: z.string().datetime().optional(),
})

const UpdateProjectTaskSchema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid(),
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(4000).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  expectedProjectUpdatedAt: z.string().datetime().optional(),
})

const DeleteProjectTaskSchema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid(),
  expectedProjectUpdatedAt: z.string().datetime().optional(),
})

const CreateProjectTaskAppointmentSchema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid(),
  date: DateSchema,
  startTime: TimeSchema,
  endTime: TimeSchema,
  totalMinutes: z.number().int().min(0).max(24 * 60),
  note: z.string().max(2000).optional(),
  expectedProjectUpdatedAt: z.string().datetime().optional(),
})

const UpdateProjectTaskAppointmentSchema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid(),
  appointmentId: z.string().uuid(),
  date: DateSchema.optional(),
  startTime: TimeSchema.optional(),
  endTime: TimeSchema.optional(),
  totalMinutes: z.number().int().min(0).max(24 * 60).optional(),
  note: z.string().max(2000).optional(),
  expectedProjectUpdatedAt: z.string().datetime().optional(),
})

const DeleteProjectTaskAppointmentSchema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid(),
  appointmentId: z.string().uuid(),
  expectedProjectUpdatedAt: z.string().datetime().optional(),
})

const CreateProjectExpenseSchema = z.object({
  projectId: z.string().uuid(),
  description: z.string().min(1).max(500),
  supplier: z.string().max(200).optional(),
  quantity: z.number().positive(),
  unitValue: z.number().nonnegative(),
})

const UpdateProjectExpenseSchema = z.object({
  projectId: z.string().uuid(),
  expenseId: z.string().uuid(),
  description: z.string().min(1).max(500).optional(),
  supplier: z.string().max(200).optional(),
  quantity: z.number().positive().optional(),
  unitValue: z.number().nonnegative().optional(),
})

const DeleteProjectExpenseSchema = z.object({
  projectId: z.string().uuid(),
  expenseId: z.string().uuid(),
})

const UploadProjectExpenseAttachmentSchema = z.object({
  projectId: z.string().uuid(),
  expenseId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  base64Content: z.string().min(1),
})

const DeleteProjectExpenseAttachmentSchema = z.object({
  projectId: z.string().uuid(),
  expenseId: z.string().uuid(),
  attachmentId: z.string().uuid(),
})

const UploadProjectAttachmentSchema = z.object({
  projectId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  base64Content: z.string().min(1),
})

const DeleteProjectAttachmentSchema = z.object({
  projectId: z.string().uuid(),
  attachmentId: z.string().uuid(),
})

function ipcError(code: string, message?: string): never {
  throw Object.assign(new Error(message ?? code), { code })
}

function mapProjectServiceError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('PROJECT_TASK_APPOINTMENT_NOT_FOUND')) ipcError('PROJECT_TASK_APPOINTMENT_NOT_FOUND')
  if (message.includes('PROJECT_TASK_NOT_FOUND')) ipcError('PROJECT_TASK_NOT_FOUND')
  if (message.includes('PROJECT_NOT_FOUND')) ipcError('PROJECT_NOT_FOUND')
  if (message.includes('PROJECT_CONFLICT')) ipcError('PROJECT_CONFLICT')
  if (message.includes('EXPENSE_NOT_FOUND')) ipcError('EXPENSE_NOT_FOUND')
  if (message.includes('ATTACHMENT_NOT_FOUND')) ipcError('ATTACHMENT_NOT_FOUND')
  if (message.includes('UNSUPPORTED_FILE_TYPE')) ipcError('UNSUPPORTED_FILE_TYPE')
  if (message.includes('FILE_TOO_LARGE')) ipcError('FILE_TOO_LARGE')
  if (message.includes('BLOB_NOT_CONFIGURED')) ipcError('BLOB_NOT_CONFIGURED')
  if (message.includes('FORBIDDEN')) ipcError('FORBIDDEN')
  throw error
}

async function requireAuthenticatedUser() {
  const user = await resolveAuthenticatedUser()
  if (!user) ipcError('UNAUTHORIZED')
  return user
}

async function requireManagerOrAdmin() {
  const user = await requireAuthenticatedUser()
  if (user.role !== 'manager' && user.role !== 'admin') {
    ipcError('FORBIDDEN')
  }
  return user
}

async function assertProjectTaskAccess(
  projectId: string,
  taskId: string,
  userId: string,
  role: 'member' | 'manager' | 'admin',
): Promise<void> {
  const project = await getProjectById(projectId)
  if (!project) ipcError('PROJECT_NOT_FOUND')
  const task = project.tasks.find((item) => item.id === taskId)
  if (!task) ipcError('PROJECT_TASK_NOT_FOUND')
  if (role === 'member' && !isTaskAccessibleByUser(task, userId)) ipcError('FORBIDDEN')
}

export function registerProjectHandlers(): void {
  ipcMain.handle('project:list', async () => {
    await requireAuthenticatedUser()
    return listProjects()
  })

  ipcMain.handle('project:get-by-id', async (_event, projectId: unknown) => {
    await requireAuthenticatedUser()
    const parsed = z.string().uuid().safeParse(projectId)
    if (!parsed.success) ipcError('INVALID_INPUT')
    const project = await getProjectById(parsed.data)
    if (!project) ipcError('PROJECT_NOT_FOUND')
    return project
  })

  ipcMain.handle('project:create', async (_event, payload: unknown) => {
    await requireManagerOrAdmin()
    const parsed = CreateProjectSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    return createProject(parsed.data)
  })

  ipcMain.handle('project:update', async (_event, payload: unknown) => {
    await requireManagerOrAdmin()
    const parsed = UpdateProjectSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    try {
      return await updateProject(parsed.data)
    } catch (error) {
      mapProjectServiceError(error)
    }
  })

  ipcMain.handle('project:delete', async (_event, projectId: unknown) => {
    await requireManagerOrAdmin()
    const parsed = z.string().uuid().safeParse(projectId)
    if (!parsed.success) ipcError('INVALID_INPUT')
    await deleteProject(parsed.data)
  })

  ipcMain.handle('project:create-task', async (_event, payload: unknown) => {
    await requireManagerOrAdmin()
    const parsed = CreateProjectTaskSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    try {
      return await createProjectTask(parsed.data)
    } catch (error) {
      mapProjectServiceError(error)
    }
  })

  ipcMain.handle('project:update-task', async (_event, payload: unknown) => {
    await requireManagerOrAdmin()
    const parsed = UpdateProjectTaskSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    try {
      return await updateProjectTask(parsed.data)
    } catch (error) {
      mapProjectServiceError(error)
    }
  })

  ipcMain.handle('project:delete-task', async (_event, payload: unknown) => {
    await requireManagerOrAdmin()
    const parsed = DeleteProjectTaskSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')
    try {
      return await deleteProjectTask(parsed.data)
    } catch (error) {
      mapProjectServiceError(error)
    }
  })

  ipcMain.handle('project:create-task-appointment', async (_event, payload: unknown) => {
    const user = await requireAuthenticatedUser()
    const parsed = CreateProjectTaskAppointmentSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    await assertProjectTaskAccess(parsed.data.projectId, parsed.data.taskId, user.id, user.role)

    try {
      return await createProjectTaskAppointment(parsed.data, user.id)
    } catch (error) {
      mapProjectServiceError(error)
    }
  })

  ipcMain.handle('project:update-task-appointment', async (_event, payload: unknown) => {
    const user = await requireAuthenticatedUser()
    const parsed = UpdateProjectTaskAppointmentSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    await assertProjectTaskAccess(parsed.data.projectId, parsed.data.taskId, user.id, user.role)

    try {
      return await updateProjectTaskAppointment(parsed.data)
    } catch (error) {
      mapProjectServiceError(error)
    }
  })

  ipcMain.handle('project:delete-task-appointment', async (_event, payload: unknown) => {
    const user = await requireAuthenticatedUser()
    const parsed = DeleteProjectTaskAppointmentSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    await assertProjectTaskAccess(parsed.data.projectId, parsed.data.taskId, user.id, user.role)

    try {
      return await deleteProjectTaskAppointment(parsed.data)
    } catch (error) {
      mapProjectServiceError(error)
    }
  })

  ipcMain.handle('project:create-expense', async (_event, payload: unknown) => {
    await requireAuthenticatedUser()
    const parsed = CreateProjectExpenseSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await createProjectExpense(parsed.data)
    } catch (error) {
      mapProjectServiceError(error)
    }
  })

  ipcMain.handle('project:update-expense', async (_event, payload: unknown) => {
    await requireAuthenticatedUser()
    const parsed = UpdateProjectExpenseSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await updateProjectExpense(parsed.data)
    } catch (error) {
      mapProjectServiceError(error)
    }
  })

  ipcMain.handle('project:delete-expense', async (_event, payload: unknown) => {
    await requireAuthenticatedUser()
    const parsed = DeleteProjectExpenseSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await deleteProjectExpense(parsed.data)
    } catch (error) {
      mapProjectServiceError(error)
    }
  })

  ipcMain.handle('project:upload-expense-attachment', async (_event, payload: unknown) => {
    const user = await requireAuthenticatedUser()
    const parsed = UploadProjectExpenseAttachmentSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await uploadProjectExpenseAttachment({
        ...parsed.data,
        uploadedBy: user.id,
      })
    } catch (error) {
      mapProjectServiceError(error)
    }
  })

  ipcMain.handle('project:delete-expense-attachment', async (_event, payload: unknown) => {
    await requireAuthenticatedUser()
    const parsed = DeleteProjectExpenseAttachmentSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await deleteProjectExpenseAttachment(parsed.data)
    } catch (error) {
      mapProjectServiceError(error)
    }
  })

  ipcMain.handle('project:list-attachments', async (_event, projectId: unknown) => {
    await requireAuthenticatedUser()
    const parsed = z.string().uuid().safeParse(projectId)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await listProjectAttachments(parsed.data)
    } catch (error) {
      mapProjectServiceError(error)
    }
  })

  ipcMain.handle('project:upload-attachment', async (_event, payload: unknown) => {
    const user = await requireAuthenticatedUser()
    const parsed = UploadProjectAttachmentSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await uploadProjectAttachment({
        ...parsed.data,
        uploadedBy: user.id,
      })
    } catch (error) {
      mapProjectServiceError(error)
    }
  })

  ipcMain.handle('project:delete-attachment', async (_event, payload: unknown) => {
    await requireAuthenticatedUser()
    const parsed = DeleteProjectAttachmentSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await deleteProjectAttachment(parsed.data)
    } catch (error) {
      mapProjectServiceError(error)
    }
  })
}
