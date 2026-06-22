import { randomUUID } from 'crypto'
import { ZEEV_STEPS } from '../../shared/lib/zeev-steps'
import type { Workflow, WorkflowStep, WorkflowTransition } from '../../shared/types'
import { getContainer } from './cosmos'
import { createWorkflow, getDefaultWorkflow, listWorkflows, setDefaultWorkflow } from './workflow'

const ZEEV_WORKFLOW_NAME = 'Fluxo Zeev (padrão)'

function buildZeevSteps(): WorkflowStep[] {
  const defs: Array<{ id: string; name: string; type: WorkflowStep['type']; order: number; slaHours?: number }> = [
    { id: ZEEV_STEPS.open, name: 'Aberto', type: 'automatic', order: 1 },
    { id: ZEEV_STEPS.awaiting_it_manager_approval, name: 'Aguardando Gestor TI', type: 'approval', order: 2 },
    { id: ZEEV_STEPS.improvement_rejected_by_it, name: 'Melhoria recusada (TI)', type: 'manual', order: 3 },
    { id: ZEEV_STEPS.awaiting_app_manager_approval, name: 'Aguardando Gestor App', type: 'approval', order: 4 },
    { id: ZEEV_STEPS.improvement_rejected_by_app, name: 'Melhoria recusada (App)', type: 'manual', order: 5 },
    { id: ZEEV_STEPS.improvement_approved, name: 'Melhoria aprovada', type: 'automatic', order: 6 },
    { id: ZEEV_STEPS.in_triage, name: 'Em triagem', type: 'manual', order: 7, slaHours: 8 },
    { id: ZEEV_STEPS.triage_rejected, name: 'Recusado na triagem', type: 'manual', order: 8 },
    { id: ZEEV_STEPS.awaiting_requester_adjustment, name: 'Aguardando ajuste', type: 'manual', order: 9 },
    { id: ZEEV_STEPS.adjustment_pending, name: 'Ajuste em andamento', type: 'manual', order: 10 },
    { id: ZEEV_STEPS.cancelled_adjustment_timeout, name: 'Cancelado (prazo)', type: 'manual', order: 11 },
    { id: ZEEV_STEPS.awaiting_cancellation_approval, name: 'Aguardando cancelamento', type: 'approval', order: 12 },
    { id: ZEEV_STEPS.cancellation_approved, name: 'Cancelamento aprovado', type: 'automatic', order: 13 },
    { id: ZEEV_STEPS.cancellation_rejected, name: 'Cancelamento recusado', type: 'manual', order: 14 },
    { id: ZEEV_STEPS.cancellation_completed, name: 'Cancelamento concluído', type: 'manual', order: 15 },
    { id: ZEEV_STEPS.awaiting_service, name: 'Aguardando atendimento', type: 'manual', order: 16 },
    { id: ZEEV_STEPS.in_service, name: 'Em atendimento', type: 'manual', order: 17, slaHours: 24 },
    {
      id: ZEEV_STEPS.awaiting_completion_approval,
      name: 'Aguardando aprovação de conclusão',
      type: 'approval',
      order: 18,
    },
    { id: ZEEV_STEPS.resolved, name: 'Resolvido', type: 'manual', order: 19 },
    { id: ZEEV_STEPS.awaiting_evaluation, name: 'Aguardando avaliação', type: 'manual', order: 20 },
    { id: ZEEV_STEPS.completed, name: 'Concluído', type: 'manual', order: 21 },
    { id: ZEEV_STEPS.cancelled, name: 'Cancelado', type: 'manual', order: 22 },
  ]
  return defs.map((d) => ({ ...d }))
}

function buildZeevTransitions(): WorkflowTransition[] {
  const t = (from: string, to: string): WorkflowTransition => ({
    id: randomUUID(),
    fromStepId: from,
    toStepId: to,
    conditions: [],
  })

  return [
    t(ZEEV_STEPS.open, ZEEV_STEPS.awaiting_it_manager_approval),
    t(ZEEV_STEPS.open, ZEEV_STEPS.in_triage),
    t(ZEEV_STEPS.open, ZEEV_STEPS.awaiting_cancellation_approval),
    t(ZEEV_STEPS.open, ZEEV_STEPS.cancellation_completed),
    t(ZEEV_STEPS.awaiting_it_manager_approval, ZEEV_STEPS.awaiting_app_manager_approval),
    t(ZEEV_STEPS.awaiting_it_manager_approval, ZEEV_STEPS.improvement_rejected_by_it),
    t(ZEEV_STEPS.awaiting_it_manager_approval, ZEEV_STEPS.awaiting_requester_adjustment),
    t(ZEEV_STEPS.awaiting_app_manager_approval, ZEEV_STEPS.improvement_approved),
    t(ZEEV_STEPS.awaiting_app_manager_approval, ZEEV_STEPS.improvement_rejected_by_app),
    t(ZEEV_STEPS.awaiting_app_manager_approval, ZEEV_STEPS.awaiting_requester_adjustment),
    t(ZEEV_STEPS.improvement_approved, ZEEV_STEPS.in_triage),
    t(ZEEV_STEPS.in_triage, ZEEV_STEPS.awaiting_service),
    t(ZEEV_STEPS.in_triage, ZEEV_STEPS.triage_rejected),
    t(ZEEV_STEPS.in_triage, ZEEV_STEPS.awaiting_requester_adjustment),
    t(ZEEV_STEPS.awaiting_requester_adjustment, ZEEV_STEPS.adjustment_pending),
    t(ZEEV_STEPS.adjustment_pending, ZEEV_STEPS.in_triage),
    t(ZEEV_STEPS.adjustment_pending, ZEEV_STEPS.cancelled_adjustment_timeout),
    t(ZEEV_STEPS.awaiting_cancellation_approval, ZEEV_STEPS.cancellation_approved),
    t(ZEEV_STEPS.awaiting_cancellation_approval, ZEEV_STEPS.cancellation_rejected),
    t(ZEEV_STEPS.cancellation_approved, ZEEV_STEPS.cancellation_completed),
    t(ZEEV_STEPS.awaiting_service, ZEEV_STEPS.in_service),
    t(ZEEV_STEPS.in_service, ZEEV_STEPS.awaiting_completion_approval),
    t(ZEEV_STEPS.in_service, ZEEV_STEPS.resolved),
    t(ZEEV_STEPS.awaiting_completion_approval, ZEEV_STEPS.awaiting_evaluation),
    t(ZEEV_STEPS.awaiting_completion_approval, ZEEV_STEPS.in_service),
    t(ZEEV_STEPS.resolved, ZEEV_STEPS.awaiting_evaluation),
    t(ZEEV_STEPS.awaiting_evaluation, ZEEV_STEPS.completed),
  ]
}

export async function ensureZeevDefaultWorkflow(): Promise<Workflow> {
  const existing = await listWorkflows()
  const zeev = existing.find((w) => w.name === ZEEV_WORKFLOW_NAME)
  if (zeev) {
    const currentDefault = await getDefaultWorkflow()
    if (!currentDefault || currentDefault.id !== zeev.id) {
      await setDefaultWorkflow(zeev.id)
    }
    return zeev
  }

  const created = await createWorkflow({
    name: ZEEV_WORKFLOW_NAME,
    description: 'Workflow padrão migrado do Zeev',
    isDefault: true,
    steps: buildZeevSteps(),
    transitions: buildZeevTransitions(),
  })
  return created
}

export async function findZeevWorkflow(): Promise<Workflow | null> {
  const workflows = await listWorkflows()
  return workflows.find((w) => w.name === ZEEV_WORKFLOW_NAME) ?? null
}
