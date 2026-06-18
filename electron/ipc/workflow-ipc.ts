import { ipcMain } from 'electron'
import { z } from 'zod'
import { resolveAuthenticatedUser } from '../services/session-user'
import {
  createWorkflow,
  deleteWorkflow,
  listWorkflows,
  setDefaultWorkflow,
  updateWorkflow,
} from '../services/workflow'

const WorkflowConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['equal', 'not_equal', 'in', 'not_in']),
  value: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
})

const WorkflowStepSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  type: z.enum(['manual', 'approval', 'automatic']),
  defaultAssigneeId: z.string().uuid().optional(),
  slaHours: z.number().positive().max(24 * 365).optional(),
  order: z.number().int().positive(),
})

const WorkflowTransitionSchema = z.object({
  id: z.string().uuid().optional(),
  fromStepId: z.string().uuid(),
  toStepId: z.string().uuid(),
  conditions: z.array(WorkflowConditionSchema),
})

const CreateWorkflowSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  steps: z.array(WorkflowStepSchema).min(1),
  transitions: z.array(WorkflowTransitionSchema),
})

const UpdateWorkflowSchema = CreateWorkflowSchema.partial().extend({
  id: z.string().uuid(),
})

function ipcError(code: string, message?: string): never {
  throw Object.assign(new Error(message ?? code), { code })
}

async function requireAuthenticatedUser() {
  const user = await resolveAuthenticatedUser()
  if (!user) ipcError('UNAUTHORIZED')
  return user
}

async function requireAdminUser() {
  const user = await requireAuthenticatedUser()
  if (user.role !== 'admin') ipcError('FORBIDDEN')
  return user
}

function mapServiceError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('WORKFLOW_NOT_FOUND')) ipcError('WORKFLOW_NOT_FOUND')
  if (message.includes('WORKFLOW_LAST_DELETE_FORBIDDEN')) ipcError('WORKFLOW_LAST_DELETE_FORBIDDEN')
  if (message.includes('WORKFLOW_DEFAULT_REQUIRED')) ipcError('WORKFLOW_DEFAULT_REQUIRED')
  if (message.includes('WORKFLOW_STEPS_REQUIRED')) ipcError('INVALID_INPUT')
  if (message.includes('WORKFLOW_INITIAL_STEP_REQUIRED')) ipcError('INVALID_INPUT')
  if (message.includes('WORKFLOW_TRANSITION_INVALID_STEP')) ipcError('INVALID_INPUT')
  if (message.includes('DUPLICATE_STEP_ID')) ipcError('INVALID_INPUT')
  if (message.includes('DUPLICATE_TRANSITION_ID')) ipcError('INVALID_INPUT')

  throw error
}

export function registerWorkflowHandlers(): void {
  ipcMain.handle('workflow:list', async () => {
    await requireAuthenticatedUser()
    return listWorkflows()
  })

  ipcMain.handle('workflow:create', async (_event, payload: unknown) => {
    await requireAdminUser()
    const parsed = CreateWorkflowSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await createWorkflow(parsed.data)
    } catch (error) {
      mapServiceError(error)
    }
  })

  ipcMain.handle('workflow:update', async (_event, payload: unknown) => {
    await requireAdminUser()
    const parsed = UpdateWorkflowSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await updateWorkflow(parsed.data)
    } catch (error) {
      mapServiceError(error)
    }
  })

  ipcMain.handle('workflow:delete', async (_event, workflowId: unknown) => {
    await requireAdminUser()
    const parsed = z.string().uuid().safeParse(workflowId)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      await deleteWorkflow(parsed.data)
    } catch (error) {
      mapServiceError(error)
    }
  })

  ipcMain.handle('workflow:set-default', async (_event, workflowId: unknown) => {
    await requireAdminUser()
    const parsed = z.string().uuid().safeParse(workflowId)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      return await setDefaultWorkflow(parsed.data)
    } catch (error) {
      mapServiceError(error)
    }
  })
}
