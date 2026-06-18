import { randomUUID } from 'crypto'
import type {
  CreateWorkflowPayload,
  UpdateWorkflowPayload,
  Workflow,
  WorkflowCondition,
  WorkflowStep,
  WorkflowTransition,
} from '../../shared/types'
import { getContainer } from './cosmos'

const CONTAINER = 'workflows'

function normalizeText(value: string): string {
  return value.trim()
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function normalizeStep(step: WorkflowStep, index: number): WorkflowStep {
  return {
    ...step,
    name: normalizeText(step.name),
    defaultAssigneeId: normalizeOptionalText(step.defaultAssigneeId),
    slaHours: step.slaHours === undefined ? undefined : step.slaHours,
    order: step.order ?? index + 1,
  }
}

function normalizeCondition(condition: WorkflowCondition): WorkflowCondition {
  return {
    field: normalizeText(condition.field),
    operator: condition.operator,
    value: Array.isArray(condition.value)
      ? condition.value.map((item) => normalizeText(item))
      : normalizeText(condition.value),
  }
}

function normalizeTransition(transition: WorkflowTransition): WorkflowTransition {
  return {
    ...transition,
    fromStepId: normalizeText(transition.fromStepId),
    toStepId: normalizeText(transition.toStepId),
    conditions: transition.conditions.map(normalizeCondition),
  }
}

function validateWorkflowStructure(steps: WorkflowStep[], transitions: WorkflowTransition[]): void {
  if (steps.length === 0) throw new Error('WORKFLOW_STEPS_REQUIRED')

  const stepIds = new Set<string>()
  for (const step of steps) {
    if (stepIds.has(step.id)) throw new Error('DUPLICATE_STEP_ID')
    stepIds.add(step.id)
  }

  const hasInitialStep = steps.some((step) => step.order === 1)
  if (!hasInitialStep) throw new Error('WORKFLOW_INITIAL_STEP_REQUIRED')

  const transitionIds = new Set<string>()
  for (const transition of transitions) {
    if (transitionIds.has(transition.id)) throw new Error('DUPLICATE_TRANSITION_ID')
    transitionIds.add(transition.id)

    if (!stepIds.has(transition.fromStepId) || !stepIds.has(transition.toStepId)) {
      throw new Error('WORKFLOW_TRANSITION_INVALID_STEP')
    }
  }
}

function toWorkflowFromCreate(payload: CreateWorkflowPayload): Workflow {
  const now = new Date().toISOString()

  const steps: WorkflowStep[] = payload.steps.map((step, index) =>
    normalizeStep(
      {
        id: step.id ?? randomUUID(),
        name: step.name,
        type: step.type,
        defaultAssigneeId: step.defaultAssigneeId,
        slaHours: step.slaHours,
        order: step.order,
      },
      index,
    ),
  )

  const transitions: WorkflowTransition[] = payload.transitions.map((transition) =>
    normalizeTransition({
      id: transition.id ?? randomUUID(),
      fromStepId: transition.fromStepId,
      toStepId: transition.toStepId,
      conditions: transition.conditions,
    }),
  )

  validateWorkflowStructure(steps, transitions)

  return {
    id: randomUUID(),
    name: normalizeText(payload.name),
    description: normalizeOptionalText(payload.description),
    isDefault: Boolean(payload.isDefault),
    steps,
    transitions,
    createdAt: now,
    updatedAt: now,
  }
}

export async function listWorkflows(): Promise<Workflow[]> {
  const container = await getContainer(CONTAINER)
  const { resources } = await container.items
    .query<Workflow>('SELECT * FROM c ORDER BY c.updatedAt DESC')
    .fetchAll()
  return resources
}

export async function getWorkflowById(workflowId: string): Promise<Workflow | null> {
  const container = await getContainer(CONTAINER)
  try {
    const { resource } = await container.item(workflowId, workflowId).read<Workflow>()
    return resource ?? null
  } catch {
    return null
  }
}

export async function getDefaultWorkflow(): Promise<Workflow | null> {
  const container = await getContainer(CONTAINER)
  const { resources } = await container.items
    .query<Workflow>({
      query: 'SELECT TOP 1 * FROM c WHERE c.isDefault = true ORDER BY c.updatedAt DESC',
    })
    .fetchAll()
  return resources[0] ?? null
}

async function unsetOtherDefaults(exceptWorkflowId?: string): Promise<void> {
  const workflows = await listWorkflows()
  const container = await getContainer(CONTAINER)

  for (const workflow of workflows) {
    if (!workflow.isDefault) continue
    if (exceptWorkflowId && workflow.id === exceptWorkflowId) continue

    await container.item(workflow.id, workflow.id).replace<Workflow>({
      ...workflow,
      isDefault: false,
      updatedAt: new Date().toISOString(),
    })
  }
}

export async function createWorkflow(payload: CreateWorkflowPayload): Promise<Workflow> {
  const container = await getContainer(CONTAINER)
  const doc = toWorkflowFromCreate(payload)

  const currentDefault = await getDefaultWorkflow()
  if (!currentDefault) {
    doc.isDefault = true
  } else if (doc.isDefault) {
    await unsetOtherDefaults()
  }

  const { resource } = await container.items.create<Workflow>(doc)
  return resource as Workflow
}

export async function updateWorkflow(payload: UpdateWorkflowPayload): Promise<Workflow> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(payload.id, payload.id).read<Workflow>()
  if (!existing) throw new Error('WORKFLOW_NOT_FOUND')

  const steps = payload.steps
    ? payload.steps.map((step, index) =>
        normalizeStep(
          {
            id: step.id ?? randomUUID(),
            name: step.name,
            type: step.type,
            defaultAssigneeId: step.defaultAssigneeId,
            slaHours: step.slaHours,
            order: step.order,
          },
          index,
        ),
      )
    : existing.steps

  const transitions = payload.transitions
    ? payload.transitions.map((transition) =>
        normalizeTransition({
          id: transition.id ?? randomUUID(),
          fromStepId: transition.fromStepId,
          toStepId: transition.toStepId,
          conditions: transition.conditions,
        }),
      )
    : existing.transitions

  validateWorkflowStructure(steps, transitions)

  const updated: Workflow = {
    ...existing,
    name: payload.name ? normalizeText(payload.name) : existing.name,
    description:
      payload.description === undefined
        ? existing.description
        : normalizeOptionalText(payload.description),
    isDefault: payload.isDefault ?? existing.isDefault,
    steps,
    transitions,
    updatedAt: new Date().toISOString(),
  }

  if (existing.isDefault && updated.isDefault === false) {
    const currentDefault = await getDefaultWorkflow()
    if (currentDefault && currentDefault.id === existing.id) {
      throw new Error('WORKFLOW_DEFAULT_REQUIRED')
    }
  }

  if (updated.isDefault) {
    await unsetOtherDefaults(updated.id)
  }

  const { resource } = await container.item(payload.id, payload.id).replace<Workflow>(updated)
  return resource as Workflow
}

export async function setDefaultWorkflow(workflowId: string): Promise<Workflow> {
  const workflow = await getWorkflowById(workflowId)
  if (!workflow) throw new Error('WORKFLOW_NOT_FOUND')

  await unsetOtherDefaults(workflowId)

  const container = await getContainer(CONTAINER)
  const updated: Workflow = {
    ...workflow,
    isDefault: true,
    updatedAt: new Date().toISOString(),
  }
  const { resource } = await container.item(workflowId, workflowId).replace<Workflow>(updated)
  return resource as Workflow
}

export async function deleteWorkflow(workflowId: string): Promise<void> {
  const container = await getContainer(CONTAINER)
  const workflow = await getWorkflowById(workflowId)
  if (!workflow) throw new Error('WORKFLOW_NOT_FOUND')

  const all = await listWorkflows()
  if (all.length <= 1) {
    throw new Error('WORKFLOW_LAST_DELETE_FORBIDDEN')
  }

  await container.item(workflowId, workflowId).delete()

  if (workflow.isDefault) {
    const remaining = await listWorkflows()
    const candidate = remaining[0]
    if (candidate) {
      await setDefaultWorkflow(candidate.id)
    }
  }
}

export function findInitialStep(workflow: Workflow): WorkflowStep {
  const sorted = [...workflow.steps].sort((a, b) => a.order - b.order)
  const initial = sorted.find((step) => step.order === 1) ?? sorted[0]
  if (!initial) throw new Error('WORKFLOW_INITIAL_STEP_REQUIRED')
  return initial
}

function conditionMatches(ticketValue: unknown, condition: WorkflowCondition): boolean {
  const expected = condition.value

  if (condition.operator === 'equal') {
    return Array.isArray(expected)
      ? expected.includes(String(ticketValue ?? ''))
      : String(ticketValue ?? '') === expected
  }

  if (condition.operator === 'not_equal') {
    return Array.isArray(expected)
      ? !expected.includes(String(ticketValue ?? ''))
      : String(ticketValue ?? '') !== expected
  }

  if (condition.operator === 'in') {
    const values = Array.isArray(expected) ? expected : [expected]
    return values.includes(String(ticketValue ?? ''))
  }

  const values = Array.isArray(expected) ? expected : [expected]
  return !values.includes(String(ticketValue ?? ''))
}

function readTicketField(ticket: Record<string, unknown>, field: string): unknown {
  if (field.includes('.')) {
    return field.split('.').reduce<unknown>((acc, key) => {
      if (!acc || typeof acc !== 'object') return undefined
      return (acc as Record<string, unknown>)[key]
    }, ticket)
  }

  return ticket[field]
}

export function canTransitionTicket(
  workflow: Workflow,
  fromStepId: string,
  toStepId: string,
  ticket: Record<string, unknown>,
): boolean {
  return workflow.transitions.some((transition) => {
    if (transition.fromStepId !== fromStepId || transition.toStepId !== toStepId) {
      return false
    }

    if (transition.conditions.length === 0) return true

    return transition.conditions.every((condition) => {
      const ticketValue = readTicketField(ticket, condition.field)
      return conditionMatches(ticketValue, condition)
    })
  })
}
