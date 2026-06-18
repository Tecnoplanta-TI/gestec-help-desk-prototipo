import { randomUUID } from 'crypto'
import type { ActiveTimer, Appointment } from '../../shared/types'
import { getContainer } from './cosmos'
import { appendTimerAppointmentToTicket } from './ticket'
import { appendTimerAppointmentToProjectTask } from './project'

const CONTAINER = 'active_timers'

interface ActiveTimerDocument extends ActiveTimer {
  createdAt: string
  updatedAt: string
}

export interface StopTimerResult {
  timer: ActiveTimer
  appointment: Appointment
}

function toPublicTimer(doc: ActiveTimerDocument): ActiveTimer {
  const { createdAt: _c, updatedAt: _u, ...timer } = doc
  return timer
}

function elapsedSecondsSince(startedAt: string): number {
  const start = new Date(startedAt).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((now - start) / 1000))
}

export async function listActiveTimersByTechnician(technicianId: string): Promise<ActiveTimer[]> {
  const container = await getContainer(CONTAINER)
  const { resources } = await container.items
    .query<ActiveTimerDocument>({
      query: 'SELECT * FROM c WHERE c.technicianId = @technicianId',
      parameters: [{ name: '@technicianId', value: technicianId }],
    })
    .fetchAll()

  return resources.map(toPublicTimer)
}

async function findTimerDocument(timerId: string): Promise<ActiveTimerDocument | null> {
  const container = await getContainer(CONTAINER)
  try {
    const { resource } = await container.item(timerId, timerId).read<ActiveTimerDocument>()
    return resource ?? null
  } catch {
    return null
  }
}

async function replaceTimerDocument(doc: ActiveTimerDocument): Promise<ActiveTimerDocument> {
  const container = await getContainer(CONTAINER)
  const { resource } = await container.item(doc.id, doc.id).replace<ActiveTimerDocument>(doc)
  return resource as ActiveTimerDocument
}

export async function startTimer(input: {
  entityId: string
  entityType: ActiveTimer['entityType']
  entityTitle: string
  technicianId: string
}): Promise<ActiveTimer> {
  const existingForEntity = (await listActiveTimersByTechnician(input.technicianId)).find(
    (timer) => timer.entityId === input.entityId && timer.entityType === input.entityType,
  )

  if (existingForEntity) {
    if (existingForEntity.state === 'running') {
      return existingForEntity
    }

    const existingDoc = await findTimerDocument(existingForEntity.id)
    if (!existingDoc) {
      throw new Error('TIMER_NOT_FOUND')
    }

    const resumedDoc: ActiveTimerDocument = {
      ...existingDoc,
      state: 'running',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const saved = await replaceTimerDocument(resumedDoc)
    return toPublicTimer(saved)
  }

  const now = new Date().toISOString()
  const doc: ActiveTimerDocument = {
    id: randomUUID(),
    entityId: input.entityId,
    entityType: input.entityType,
    entityTitle: input.entityTitle,
    state: 'running',
    startedAt: now,
    accumulatedSeconds: 0,
    technicianId: input.technicianId,
    createdAt: now,
    updatedAt: now,
  }

  const container = await getContainer(CONTAINER)
  const { resource } = await container.items.create<ActiveTimerDocument>(doc)
  return toPublicTimer(resource as ActiveTimerDocument)
}

export async function pauseTimer(timerId: string, technicianId: string): Promise<ActiveTimer> {
  const existing = await findTimerDocument(timerId)
  if (!existing) throw new Error('TIMER_NOT_FOUND')
  if (existing.technicianId !== technicianId) throw new Error('FORBIDDEN')

  if (existing.state === 'paused') {
    return toPublicTimer(existing)
  }

  if (existing.state !== 'running') {
    throw new Error('INVALID_STATE')
  }

  const elapsed = elapsedSecondsSince(existing.startedAt)
  const updated: ActiveTimerDocument = {
    ...existing,
    state: 'paused',
    accumulatedSeconds: existing.accumulatedSeconds + elapsed,
    updatedAt: new Date().toISOString(),
  }

  const saved = await replaceTimerDocument(updated)
  return toPublicTimer(saved)
}

export async function stopTimer(timerId: string, technicianId: string): Promise<StopTimerResult> {
  const existing = await findTimerDocument(timerId)
  if (!existing) throw new Error('TIMER_NOT_FOUND')
  if (existing.technicianId !== technicianId) throw new Error('FORBIDDEN')

  const endedAt = new Date().toISOString()
  const elapsed = existing.state === 'running' ? elapsedSecondsSince(existing.startedAt) : 0
  const totalSeconds = existing.accumulatedSeconds + elapsed

  const appointment: Appointment =
    existing.entityType === 'ticket'
      ? await appendTimerAppointmentToTicket({
          ticketId: existing.entityId,
          technicianId,
          startedAt: existing.createdAt,
          endedAt,
          totalSeconds,
        })
      : await appendTimerAppointmentToProjectTask({
          taskId: existing.entityId,
          technicianId,
          startedAt: existing.createdAt,
          endedAt,
          totalSeconds,
        })

  const container = await getContainer(CONTAINER)
  await container.item(existing.id, existing.id).delete()

  return {
    timer: toPublicTimer(existing),
    appointment,
  }
}

export async function getCurrentTimersSnapshot(technicianId: string): Promise<ActiveTimer[]> {
  const timers = await listActiveTimersByTechnician(technicianId)

  return timers.map((timer) =>
    timer.state === 'running'
      ? {
          ...timer,
          accumulatedSeconds: timer.accumulatedSeconds + elapsedSecondsSince(timer.startedAt),
        }
      : timer,
  )
}
