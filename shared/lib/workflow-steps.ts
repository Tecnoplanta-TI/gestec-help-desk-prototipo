/** Step IDs estáveis do workflow interno — usados em ticket.status */
export const WORKFLOW_STEPS = {
  draft: 'draft',
  open: 'open',
  awaiting_it_manager_approval: 'awaiting_it_manager_approval',
  improvement_rejected_by_it: 'improvement_rejected_by_it',
  awaiting_app_manager_approval: 'awaiting_app_manager_approval',
  improvement_rejected_by_app: 'improvement_rejected_by_app',
  improvement_approved: 'improvement_approved',
  in_triage: 'in_triage',
  triage_rejected: 'triage_rejected',
  awaiting_requester_adjustment: 'awaiting_requester_adjustment',
  adjustment_pending: 'adjustment_pending',
  cancelled_adjustment_timeout: 'cancelled_adjustment_timeout',
  awaiting_cancellation_approval: 'awaiting_cancellation_approval',
  cancellation_approved: 'cancellation_approved',
  cancellation_rejected: 'cancellation_rejected',
  cancellation_completed: 'cancellation_completed',
  awaiting_service: 'awaiting_service',
  in_service: 'in_service',
  resolved: 'resolved',
  awaiting_evaluation: 'awaiting_evaluation',
  completed: 'completed',
  cancelled: 'cancelled',
  awaiting_completion_approval: 'awaiting_completion_approval',
} as const

export type WorkflowStepId = (typeof WORKFLOW_STEPS)[keyof typeof WORKFLOW_STEPS]

export const WORKFLOW_STEP_LABELS: Record<string, string> = {
  [WORKFLOW_STEPS.draft]: 'Rascunho',
  [WORKFLOW_STEPS.open]: 'Aberto',
  [WORKFLOW_STEPS.awaiting_it_manager_approval]: 'Aguardando Gestor TI',
  [WORKFLOW_STEPS.improvement_rejected_by_it]: 'Melhoria recusada (TI)',
  [WORKFLOW_STEPS.awaiting_app_manager_approval]: 'Aguardando Gestor App',
  [WORKFLOW_STEPS.improvement_rejected_by_app]: 'Melhoria recusada (App)',
  [WORKFLOW_STEPS.improvement_approved]: 'Melhoria aprovada',
  [WORKFLOW_STEPS.in_triage]: 'Em triagem',
  [WORKFLOW_STEPS.triage_rejected]: 'Recusado na triagem',
  [WORKFLOW_STEPS.awaiting_requester_adjustment]: 'Aguardando ajuste',
  [WORKFLOW_STEPS.adjustment_pending]: 'Ajuste em andamento',
  [WORKFLOW_STEPS.cancelled_adjustment_timeout]: 'Cancelado (prazo ajuste)',
  [WORKFLOW_STEPS.awaiting_cancellation_approval]: 'Aguardando aprovação cancelamento',
  [WORKFLOW_STEPS.cancellation_approved]: 'Cancelamento aprovado',
  [WORKFLOW_STEPS.cancellation_rejected]: 'Cancelamento recusado',
  [WORKFLOW_STEPS.cancellation_completed]: 'Cancelamento concluído',
  [WORKFLOW_STEPS.awaiting_service]: 'Aguardando atendimento',
  [WORKFLOW_STEPS.in_service]: 'Em atendimento',
  [WORKFLOW_STEPS.awaiting_completion_approval]: 'Aguardando aprovação de conclusão',
  [WORKFLOW_STEPS.resolved]: 'Resolvido',
  [WORKFLOW_STEPS.awaiting_evaluation]: 'Aguardando avaliação',
  [WORKFLOW_STEPS.completed]: 'Concluído',
  [WORKFLOW_STEPS.cancelled]: 'Cancelado',
}

export function getInitialStepForType(
  type: string,
  directCancellation?: boolean,
): WorkflowStepId {
  if (type === 'improvement') return WORKFLOW_STEPS.awaiting_it_manager_approval
  if (type === 'cancellation') {
    return directCancellation
      ? WORKFLOW_STEPS.cancellation_completed
      : WORKFLOW_STEPS.awaiting_cancellation_approval
  }
  return WORKFLOW_STEPS.in_triage
}
