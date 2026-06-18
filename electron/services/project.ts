import { randomUUID } from 'crypto'
import { format } from 'date-fns'
import type {
  AttachmentFile,
  Appointment,
  CreateProjectPayload,
  CreateProjectTaskAppointmentPayload,
  CreateProjectTaskPayload,
  Expense,
  Project,
  ProjectTask,
  UpdateProjectPayload,
  UpdateProjectTaskAppointmentPayload,
  UpdateProjectTaskPayload,
} from '../../shared/types'
import { buildBlobKey, deleteBlob, uploadBase64Blob } from './blob'
import { getContainer } from './cosmos'

const CONTAINER = 'projects'

interface DeleteTaskInput {
  projectId: string
  taskId: string
  expectedProjectUpdatedAt?: string
}

interface DeleteTaskAppointmentInput {
  projectId: string
  taskId: string
  appointmentId: string
  expectedProjectUpdatedAt?: string
}

export interface CreateProjectExpenseInput {
  projectId: string
  description: string
  supplier?: string
  quantity: number
  unitValue: number
}

export interface UpdateProjectExpenseInput {
  projectId: string
  expenseId: string
  description?: string
  supplier?: string
  quantity?: number
  unitValue?: number
}

export interface DeleteProjectExpenseInput {
  projectId: string
  expenseId: string
}

export interface UploadProjectExpenseAttachmentInput {
  projectId: string
  expenseId: string
  fileName: string
  mimeType: string
  base64Content: string
  uploadedBy: string
}

export interface DeleteProjectExpenseAttachmentInput {
  projectId: string
  expenseId: string
  attachmentId: string
}

export interface UploadProjectAttachmentInput {
  projectId: string
  fileName: string
  mimeType: string
  base64Content: string
  uploadedBy: string
}

export interface DeleteProjectAttachmentInput {
  projectId: string
  attachmentId: string
}

function assertOptimisticLock(expectedUpdatedAt: string | undefined, actualUpdatedAt: string): void {
  if (expectedUpdatedAt && expectedUpdatedAt !== actualUpdatedAt) {
    throw new Error('PROJECT_CONFLICT')
  }
}

function getTaskOrThrow(project: Project, taskId: string): ProjectTask {
  const task = project.tasks.find((item) => item.id === taskId)
  if (!task) throw new Error('PROJECT_TASK_NOT_FOUND')
  return task
}

function withSortedProjects(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

function normalizeProjectCollections(project: Project): Project {
  return {
    ...project,
    expenses: (project.expenses ?? []).map((expense) => ({
      ...expense,
      receiptFiles: expense.receiptFiles ?? [],
      updatedAt: expense.updatedAt ?? expense.createdAt,
    })),
    attachments: project.attachments ?? [],
  }
}

function ensureProjectExpense(project: Project, expenseId: string): Expense {
  const expense = (project.expenses ?? []).find((item) => item.id === expenseId)
  if (!expense) throw new Error('EXPENSE_NOT_FOUND')
  return expense
}

function ensureAttachment(attachments: AttachmentFile[], attachmentId: string): AttachmentFile {
  const attachment = attachments.find((item) => item.id === attachmentId)
  if (!attachment) throw new Error('ATTACHMENT_NOT_FOUND')
  return attachment
}

export function isTaskAccessibleByUser(task: ProjectTask, userId: string): boolean {
  if (!task.assigneeId) return true
  return task.assigneeId === userId
}

export async function listProjects(): Promise<Project[]> {
  const container = await getContainer(CONTAINER)
  const { resources } = await container.items
    .query<Project>('SELECT * FROM c')
    .fetchAll()
  return withSortedProjects(resources.map(normalizeProjectCollections))
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  const container = await getContainer(CONTAINER)
  try {
    const { resource } = await container.item(projectId, projectId).read<Project>()
    return resource ? normalizeProjectCollections(resource) : null
  } catch {
    return null
  }
}

export async function findProjectByTaskId(taskId: string): Promise<Project | null> {
  const container = await getContainer(CONTAINER)
  const { resources } = await container.items
    .query<Project>({
      query: 'SELECT * FROM c WHERE ARRAY_CONTAINS(c.tasks, { "id": @taskId }, true)',
      parameters: [{ name: '@taskId', value: taskId }],
    })
    .fetchAll()
  return resources[0] ? normalizeProjectCollections(resources[0]) : null
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const container = await getContainer(CONTAINER)
  const now = new Date().toISOString()

  const doc: Project = {
    id: randomUUID(),
    name: payload.name,
    description: payload.description,
    costCenter: payload.costCenter,
    hourlyRate: payload.hourlyRate,
    tasks: [],
    expenses: [],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  }

  const { resource } = await container.items.create<Project>(doc)
  return normalizeProjectCollections(resource as Project)
}

export async function updateProject(payload: UpdateProjectPayload): Promise<Project> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(payload.id, payload.id).read<Project>()
  if (!existing) throw new Error('PROJECT_NOT_FOUND')

  assertOptimisticLock(payload.expectedUpdatedAt, existing.updatedAt)

  const updated: Project = {
    ...existing,
    ...payload,
    updatedAt: new Date().toISOString(),
  }

  const { resource } = await container.item(payload.id, payload.id).replace<Project>(updated)
  return normalizeProjectCollections(resource as Project)
}

export async function deleteProject(projectId: string): Promise<void> {
  const container = await getContainer(CONTAINER)
  await container.item(projectId, projectId).delete()
}

export async function createProjectTask(payload: CreateProjectTaskPayload): Promise<Project> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(payload.projectId, payload.projectId).read<Project>()
  if (!existing) throw new Error('PROJECT_NOT_FOUND')

  assertOptimisticLock(payload.expectedProjectUpdatedAt, existing.updatedAt)

  const now = new Date().toISOString()
  const newTask: ProjectTask = {
    id: randomUUID(),
    title: payload.title,
    description: payload.description,
    assigneeId: payload.assigneeId,
    appointments: [],
    expenses: [],
    createdAt: now,
    updatedAt: now,
  }

  const updated: Project = {
    ...existing,
    tasks: [...existing.tasks, newTask],
    updatedAt: now,
  }

  const { resource } = await container.item(payload.projectId, payload.projectId).replace<Project>(updated)
  return normalizeProjectCollections(resource as Project)
}

export async function updateProjectTask(payload: UpdateProjectTaskPayload): Promise<Project> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(payload.projectId, payload.projectId).read<Project>()
  if (!existing) throw new Error('PROJECT_NOT_FOUND')

  assertOptimisticLock(payload.expectedProjectUpdatedAt, existing.updatedAt)
  getTaskOrThrow(existing, payload.taskId)

  const now = new Date().toISOString()
  const updatedTasks = existing.tasks.map((task) => {
    if (task.id !== payload.taskId) return task
    return {
      ...task,
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.assigneeId !== undefined
        ? { assigneeId: payload.assigneeId ?? undefined }
        : {}),
      updatedAt: now,
    }
  })

  const updated: Project = {
    ...existing,
    tasks: updatedTasks,
    updatedAt: now,
  }

  const { resource } = await container.item(payload.projectId, payload.projectId).replace<Project>(updated)
  return normalizeProjectCollections(resource as Project)
}

export async function deleteProjectTask(payload: DeleteTaskInput): Promise<Project> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(payload.projectId, payload.projectId).read<Project>()
  if (!existing) throw new Error('PROJECT_NOT_FOUND')

  assertOptimisticLock(payload.expectedProjectUpdatedAt, existing.updatedAt)
  getTaskOrThrow(existing, payload.taskId)

  const updated: Project = {
    ...existing,
    tasks: existing.tasks.filter((task) => task.id !== payload.taskId),
    updatedAt: new Date().toISOString(),
  }

  const { resource } = await container.item(payload.projectId, payload.projectId).replace<Project>(updated)
  return normalizeProjectCollections(resource as Project)
}

export async function createProjectTaskAppointment(
  payload: CreateProjectTaskAppointmentPayload,
  technicianId: string,
): Promise<ProjectTask> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(payload.projectId, payload.projectId).read<Project>()
  if (!existing) throw new Error('PROJECT_NOT_FOUND')

  assertOptimisticLock(payload.expectedProjectUpdatedAt, existing.updatedAt)
  const now = new Date().toISOString()
  const created: Appointment = {
    id: randomUUID(),
    date: payload.date,
    startTime: payload.startTime,
    endTime: payload.endTime,
    totalMinutes: payload.totalMinutes,
    technicianId,
    origin: 'manual',
    note: payload.note,
  }

  let updatedTask: ProjectTask | null = null
  const updatedTasks = existing.tasks.map((task) => {
    if (task.id !== payload.taskId) return task
    const nextTask: ProjectTask = {
      ...task,
      appointments: [...task.appointments, created],
      updatedAt: now,
    }
    updatedTask = nextTask
    return nextTask
  })

  if (!updatedTask) throw new Error('PROJECT_TASK_NOT_FOUND')

  const updated: Project = {
    ...existing,
    tasks: updatedTasks,
    updatedAt: now,
  }

  await container.item(payload.projectId, payload.projectId).replace<Project>(updated)
  return updatedTask
}

export async function updateProjectTaskAppointment(
  payload: UpdateProjectTaskAppointmentPayload,
): Promise<ProjectTask> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(payload.projectId, payload.projectId).read<Project>()
  if (!existing) throw new Error('PROJECT_NOT_FOUND')

  assertOptimisticLock(payload.expectedProjectUpdatedAt, existing.updatedAt)
  getTaskOrThrow(existing, payload.taskId)

  let updatedTask: ProjectTask | null = null
  const now = new Date().toISOString()
  const updatedTasks = existing.tasks.map((task) => {
    if (task.id !== payload.taskId) return task

    const hasAppointment = task.appointments.some((appointment) => appointment.id === payload.appointmentId)
    if (!hasAppointment) throw new Error('PROJECT_TASK_APPOINTMENT_NOT_FOUND')

    const nextTask: ProjectTask = {
      ...task,
      appointments: task.appointments.map((appointment) =>
        appointment.id === payload.appointmentId
          ? {
              ...appointment,
              ...(payload.date !== undefined ? { date: payload.date } : {}),
              ...(payload.startTime !== undefined ? { startTime: payload.startTime } : {}),
              ...(payload.endTime !== undefined ? { endTime: payload.endTime } : {}),
              ...(payload.totalMinutes !== undefined
                ? { totalMinutes: payload.totalMinutes }
                : {}),
              ...(payload.note !== undefined ? { note: payload.note } : {}),
            }
          : appointment,
      ),
      updatedAt: now,
    }
    updatedTask = nextTask
    return nextTask
  })

  if (!updatedTask) throw new Error('PROJECT_TASK_NOT_FOUND')

  const updated: Project = {
    ...existing,
    tasks: updatedTasks,
    updatedAt: now,
  }

  await container.item(payload.projectId, payload.projectId).replace<Project>(updated)
  return updatedTask
}

export async function deleteProjectTaskAppointment(
  payload: DeleteTaskAppointmentInput,
): Promise<ProjectTask> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(payload.projectId, payload.projectId).read<Project>()
  if (!existing) throw new Error('PROJECT_NOT_FOUND')

  assertOptimisticLock(payload.expectedProjectUpdatedAt, existing.updatedAt)
  getTaskOrThrow(existing, payload.taskId)

  let updatedTask: ProjectTask | null = null
  const now = new Date().toISOString()
  const updatedTasks = existing.tasks.map((task) => {
    if (task.id !== payload.taskId) return task

    const hasAppointment = task.appointments.some((appointment) => appointment.id === payload.appointmentId)
    if (!hasAppointment) throw new Error('PROJECT_TASK_APPOINTMENT_NOT_FOUND')

    const nextTask: ProjectTask = {
      ...task,
      appointments: task.appointments.filter((appointment) => appointment.id !== payload.appointmentId),
      updatedAt: now,
    }
    updatedTask = nextTask
    return nextTask
  })

  if (!updatedTask) throw new Error('PROJECT_TASK_NOT_FOUND')

  const updated: Project = {
    ...existing,
    tasks: updatedTasks,
    updatedAt: now,
  }

  await container.item(payload.projectId, payload.projectId).replace<Project>(updated)
  return updatedTask
}

export async function appendTimerAppointmentToProjectTask(input: {
  taskId: string
  technicianId: string
  startedAt: string
  endedAt: string
  totalSeconds: number
}): Promise<Appointment> {
  const container = await getContainer(CONTAINER)
  const project = await findProjectByTaskId(input.taskId)
  if (!project) throw new Error('PROJECT_TASK_NOT_FOUND')

  const task = project.tasks.find((item) => item.id === input.taskId)
  if (!task) throw new Error('PROJECT_TASK_NOT_FOUND')

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

  const now = new Date().toISOString()
  const updated: Project = {
    ...project,
    tasks: project.tasks.map((item) =>
      item.id === input.taskId
        ? {
            ...item,
            appointments: [...item.appointments, appointment],
            updatedAt: now,
          }
        : item,
    ),
    updatedAt: now,
  }

  await container.item(project.id, project.id).replace<Project>(updated)
  return appointment
}

export async function createProjectExpense(input: CreateProjectExpenseInput): Promise<Project> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.projectId, input.projectId).read<Project>()
  if (!existing) throw new Error('PROJECT_NOT_FOUND')

  const base = normalizeProjectCollections(existing)
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

  const updated: Project = {
    ...base,
    expenses: [...base.expenses, expense],
    updatedAt: now,
  }

  const { resource } = await container.item(base.id, base.id).replace<Project>(updated)
  return normalizeProjectCollections(resource as Project)
}

export async function updateProjectExpense(input: UpdateProjectExpenseInput): Promise<Project> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.projectId, input.projectId).read<Project>()
  if (!existing) throw new Error('PROJECT_NOT_FOUND')

  const base = normalizeProjectCollections(existing)
  ensureProjectExpense(base, input.expenseId)

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

  const updated: Project = {
    ...base,
    expenses: updatedExpenses,
    updatedAt: now,
  }

  const { resource } = await container.item(base.id, base.id).replace<Project>(updated)
  return normalizeProjectCollections(resource as Project)
}

export async function deleteProjectExpense(input: DeleteProjectExpenseInput): Promise<Project> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.projectId, input.projectId).read<Project>()
  if (!existing) throw new Error('PROJECT_NOT_FOUND')

  const base = normalizeProjectCollections(existing)
  const expense = ensureProjectExpense(base, input.expenseId)

  await Promise.all(expense.receiptFiles.map((file) => deleteBlob(file.blobKey)))

  const updated: Project = {
    ...base,
    expenses: base.expenses.filter((item) => item.id !== input.expenseId),
    updatedAt: new Date().toISOString(),
  }

  const { resource } = await container.item(base.id, base.id).replace<Project>(updated)
  return normalizeProjectCollections(resource as Project)
}

export async function uploadProjectExpenseAttachment(
  input: UploadProjectExpenseAttachmentInput,
): Promise<Project> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.projectId, input.projectId).read<Project>()
  if (!existing) throw new Error('PROJECT_NOT_FOUND')

  const base = normalizeProjectCollections(existing)
  ensureProjectExpense(base, input.expenseId)

  const attachmentId = randomUUID()
  const uploaded = await uploadBase64Blob({
    blobKey: buildBlobKey({
      entityType: 'project',
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

  const updated: Project = {
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

  const { resource } = await container.item(base.id, base.id).replace<Project>(updated)
  return normalizeProjectCollections(resource as Project)
}

export async function deleteProjectExpenseAttachment(
  input: DeleteProjectExpenseAttachmentInput,
): Promise<Project> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.projectId, input.projectId).read<Project>()
  if (!existing) throw new Error('PROJECT_NOT_FOUND')

  const base = normalizeProjectCollections(existing)
  const expense = ensureProjectExpense(base, input.expenseId)
  const attachment = ensureAttachment(expense.receiptFiles, input.attachmentId)
  await deleteBlob(attachment.blobKey)

  const now = new Date().toISOString()
  const updated: Project = {
    ...base,
    expenses: base.expenses.map((expenseItem) =>
      expenseItem.id === input.expenseId
        ? {
            ...expenseItem,
            receiptFiles: expenseItem.receiptFiles.filter((item) => item.id !== input.attachmentId),
            updatedAt: now,
          }
        : expenseItem,
    ),
    updatedAt: now,
  }

  const { resource } = await container.item(base.id, base.id).replace<Project>(updated)
  return normalizeProjectCollections(resource as Project)
}

export async function uploadProjectAttachment(input: UploadProjectAttachmentInput): Promise<Project> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.projectId, input.projectId).read<Project>()
  if (!existing) throw new Error('PROJECT_NOT_FOUND')

  const base = normalizeProjectCollections(existing)
  const attachmentId = randomUUID()

  const uploaded = await uploadBase64Blob({
    blobKey: buildBlobKey({
      entityType: 'project',
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

  const updated: Project = {
    ...base,
    attachments: [...base.attachments, attachment],
    updatedAt: now,
  }

  const { resource } = await container.item(base.id, base.id).replace<Project>(updated)
  return normalizeProjectCollections(resource as Project)
}

export async function deleteProjectAttachment(input: DeleteProjectAttachmentInput): Promise<Project> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(input.projectId, input.projectId).read<Project>()
  if (!existing) throw new Error('PROJECT_NOT_FOUND')

  const base = normalizeProjectCollections(existing)
  const attachment = ensureAttachment(base.attachments, input.attachmentId)
  await deleteBlob(attachment.blobKey)

  const updated: Project = {
    ...base,
    attachments: base.attachments.filter((item) => item.id !== input.attachmentId),
    updatedAt: new Date().toISOString(),
  }

  const { resource } = await container.item(base.id, base.id).replace<Project>(updated)
  return normalizeProjectCollections(resource as Project)
}

export async function listProjectAttachments(projectId: string): Promise<AttachmentFile[]> {
  const project = await getProjectById(projectId)
  if (!project) throw new Error('PROJECT_NOT_FOUND')
  return project.attachments ?? []
}
