import { BrowserWindow, ipcMain } from 'electron'
import { z } from 'zod'
import type { ActiveTimer, Appointment } from '../../shared/types'
import { getStoredSession } from '../services/auth'
import { resolveAuthenticatedUser } from '../services/session-user'
import {
  getCurrentTimersSnapshot,
  pauseTimer,
  startTimer,
  stopTimer,
} from '../services/timer'
import { findProjectByTaskId, isTaskAccessibleByUser } from '../services/project'

const StartTimerSchema = z.object({
  entityId: z.string().uuid(),
  entityType: z.enum(['ticket', 'project_task']),
  entityTitle: z.string().min(1).max(200),
})

let tickInterval: NodeJS.Timeout | null = null

function ipcError(code: string, message?: string): never {
  throw Object.assign(new Error(message ?? code), { code })
}

function mapTimerServiceError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('TIMER_NOT_FOUND')) ipcError('TIMER_NOT_FOUND')
  if (message.includes('FORBIDDEN')) ipcError('FORBIDDEN')
  if (message.includes('INVALID_STATE')) ipcError('INVALID_STATE')
  if (message.includes('TICKET_NOT_FOUND')) ipcError('TICKET_NOT_FOUND')
  if (message.includes('PROJECT_TASK_NOT_FOUND')) ipcError('PROJECT_TASK_NOT_FOUND')
  throw error
}

async function assertProjectTaskAccess(
  taskId: string,
  userId: string,
  role: 'member' | 'manager' | 'admin',
): Promise<void> {
  const project = await findProjectByTaskId(taskId)
  if (!project) ipcError('PROJECT_TASK_NOT_FOUND')

  const task = project.tasks.find((item) => item.id === taskId)
  if (!task) ipcError('PROJECT_TASK_NOT_FOUND')

  if (role === 'member' && !isTaskAccessibleByUser(task, userId)) {
    ipcError('FORBIDDEN')
  }
}

async function requireAuthenticatedUser() {
  const user = await resolveAuthenticatedUser()
  if (!user) ipcError('UNAUTHORIZED')
  return user
}

function broadcastTimers(timers: ActiveTimer[]): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('timer:tick', timers)
    }
  }
}

async function tickAndBroadcast(): Promise<void> {
  const session = getStoredSession()
  if (!session) {
    broadcastTimers([])
    return
  }

  const timers = await getCurrentTimersSnapshot(session.userId)
  broadcastTimers(timers)
}

function ensureTickLoopStarted(): void {
  if (tickInterval) return

  tickInterval = setInterval(() => {
    void tickAndBroadcast().catch((error) => {
      console.error('[timer] tick error:', error)
    })
  }, 1000)
}

export function registerTimerHandlers(): void {
  ensureTickLoopStarted()

  ipcMain.handle('timer:start', async (_event, entityId: string, entityType: ActiveTimer['entityType'], entityTitle: string) => {
    const user = await requireAuthenticatedUser()
    const parsed = StartTimerSchema.safeParse({ entityId, entityType, entityTitle })
    if (!parsed.success) ipcError('INVALID_INPUT')
    if (parsed.data.entityType === 'project_task') {
      await assertProjectTaskAccess(parsed.data.entityId, user.id, user.role)
    }

    try {
      const timer = await startTimer({
        entityId: parsed.data.entityId,
        entityType: parsed.data.entityType,
        entityTitle: parsed.data.entityTitle,
        technicianId: user.id,
      })
      const timers = await getCurrentTimersSnapshot(user.id)
      broadcastTimers(timers)
      return timer
    } catch (error) {
      mapTimerServiceError(error)
    }
  })

  ipcMain.handle('timer:pause', async (_event, timerId: unknown) => {
    const user = await requireAuthenticatedUser()
    const parsed = z.string().uuid().safeParse(timerId)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      const timer = await pauseTimer(parsed.data, user.id)
      const timers = await getCurrentTimersSnapshot(user.id)
      broadcastTimers(timers)
      return timer
    } catch (error) {
      mapTimerServiceError(error)
    }
  })

  ipcMain.handle('timer:stop', async (_event, timerId: unknown): Promise<Appointment> => {
    const user = await requireAuthenticatedUser()
    const parsed = z.string().uuid().safeParse(timerId)
    if (!parsed.success) ipcError('INVALID_INPUT')

    try {
      const result = await stopTimer(parsed.data, user.id)
      const timers = await getCurrentTimersSnapshot(user.id)
      broadcastTimers(timers)
      return result.appointment
    } catch (error) {
      mapTimerServiceError(error)
    }
  })

  ipcMain.handle('timer:get-active', async () => {
    const user = await requireAuthenticatedUser()
    return getCurrentTimersSnapshot(user.id)
  })
}
