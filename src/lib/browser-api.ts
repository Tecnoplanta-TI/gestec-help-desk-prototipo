/**
 * src/lib/browser-api.ts
 *
 * Implementação da ElectronAPI para o navegador via HTTP RPC.
 * Espelha electron/preload.ts — cada método chama POST /api/rpc.
 */

import type {
  ActiveTimer,
  Appointment,
  AttachmentFile,
  CreateDiscordRulePayload,
  CreateEntityExpensePayload,
  CreateProjectPayload,
  CreateProjectTaskAppointmentPayload,
  CreateProjectTaskPayload,
  CreateSlaRulePayload,
  ApproveCompletionPayload,
  ApproveTicketPayload,
  AddTicketCommentPayload,
  AppConfig,
  AuditLog,
  CreateApiIntegrationPayload,
  CompleteTicketServicePayload,
  CreateCostCenterPayload,
  CreateTicketAppointmentPayload,
  CreateTicketPayload,
  CreateTicketTaskPayload,
  CreateWorkflowPayload,
  CreateUserPayload,
  CostCenter,
  DeleteEntityAttachmentPayload,
  DeleteEntityExpensePayload,
  DeleteExpenseAttachmentPayload,
  DeleteProjectTaskAppointmentPayload,
  DeleteProjectTaskPayload,
  DeleteTicketAppointmentPayload,
  ElectronAPI,
  ExpenseEntityType,
  GetAttachmentDownloadUrlPayload,
  ListTicketsFilterPayload,
  LoginResult,
  Project,
  ProjectTask,
  ResetPasswordPayload,
  SlaRule,
  SubmitTicketEvaluationPayload,
  Ticket,
  TicketReportStats,
  TransitionTicketStepPayload,
  TriageTicketPayload,
  ToggleUserActivePayload,
  UpdateCostCenterPayload,
  UpdateEntityExpensePayload,
  UpdateProjectPayload,
  UpdateProjectTaskAppointmentPayload,
  UpdateProjectTaskPayload,
  UpdateDiscordRulePayload,
  UpdateApiIntegrationPayload,
  UpdateSlaRulePayload,
  UpdateTicketPayload,
  UpdateServiceTicketPayload,
  UpdateTicketTaskPayload,
  UpdateWorkflowPayload,
  UpdateUserPayload,
  UploadEntityAttachmentPayload,
  UploadExpenseAttachmentPayload,
  User,
  Workflow,
} from '../../shared/types'
import { clearBrowserAuthToken, getBrowserAuthToken, rpc, setBrowserAuthToken } from './browser-auth'

export const browserAPI: ElectronAPI = {
  login: async (email: string, password: string): Promise<LoginResult> => {
    const result = await rpc<LoginResult>('auth:login', email, password)
    if (result.token) setBrowserAuthToken(result.token)
    return result
  },

  logout: async (): Promise<void> => {
    clearBrowserAuthToken()
    await rpc('auth:logout')
  },

  getSession: (): Promise<LoginResult | null> => rpc('auth:get-session'),

  listUsers: (): Promise<User[]> => rpc('auth:list-users'),

  createUser: (payload: CreateUserPayload): Promise<User> => rpc('auth:create-user', payload),

  updateUser: (payload: UpdateUserPayload): Promise<User> => rpc('auth:update-user', payload),

  resetPassword: (payload: ResetPasswordPayload): Promise<void> =>
    rpc('auth:reset-password', payload),

  toggleUserActive: (payload: ToggleUserActivePayload): Promise<User> =>
    rpc('auth:toggle-user-active', payload),

  listTickets: (filter?: ListTicketsFilterPayload): Promise<Ticket[]> =>
    filter ? rpc('ticket:list-filtered', filter) : rpc('ticket:list'),

  getTicketById: (ticketId: string): Promise<Ticket> => rpc('ticket:get-by-id', ticketId),

  createTicket: (payload: CreateTicketPayload): Promise<Ticket> => rpc('ticket:create', payload),

  updateTicket: (payload: UpdateTicketPayload): Promise<Ticket> => rpc('ticket:update', payload),

  approveTicket: (payload: ApproveTicketPayload): Promise<Ticket> =>
    rpc('ticket:approve', payload),

  triageTicket: (payload: TriageTicketPayload): Promise<Ticket> =>
    rpc('ticket:triage', payload),

  startTicketService: (ticketId: string): Promise<Ticket> =>
    rpc('ticket:start-service', ticketId),

  completeTicketService: (payload: CompleteTicketServicePayload): Promise<Ticket> =>
    rpc('ticket:complete-service', payload),

  updateServiceTicket: (payload: UpdateServiceTicketPayload): Promise<Ticket> =>
    rpc('ticket:update-service', payload),

  approveTicketCompletion: (payload: ApproveCompletionPayload): Promise<Ticket> =>
    rpc('ticket:approve-completion', payload),

  submitTicketEvaluation: (payload: SubmitTicketEvaluationPayload): Promise<Ticket> =>
    rpc('ticket:submit-evaluation', payload),

  createTicketTask: (payload: CreateTicketTaskPayload): Promise<Ticket> =>
    rpc('ticket:create-task', payload),

  updateTicketTask: (payload: UpdateTicketTaskPayload): Promise<Ticket> =>
    rpc('ticket:update-task', payload),

  createTicketAppointment: (payload: CreateTicketAppointmentPayload): Promise<Ticket> =>
    rpc('ticket:create-appointment', payload),

  deleteTicketAppointment: (payload: DeleteTicketAppointmentPayload): Promise<Ticket> =>
    rpc('ticket:delete-appointment', payload),

  addTicketComment: (payload: AddTicketCommentPayload): Promise<Ticket> =>
    rpc('ticket:add-comment', payload),

  listAuditLogs: (entityId: string): Promise<AuditLog[]> => rpc('audit:list', entityId),

  listCostCenters: (): Promise<CostCenter[]> => rpc('cost-center:list'),

  createCostCenter: (payload: CreateCostCenterPayload): Promise<CostCenter> =>
    rpc('cost-center:create', payload),

  updateCostCenter: (payload: UpdateCostCenterPayload): Promise<CostCenter> =>
    rpc('cost-center:update', payload),

  getAppConfig: (): Promise<AppConfig> => rpc('app-config:get'),

  updateAppConfig: (payload: Partial<Omit<AppConfig, 'id'>>): Promise<AppConfig> =>
    rpc('app-config:update', payload),

  getTicketReportStats: (): Promise<TicketReportStats> => rpc('reports:ticket-stats'),

  transitionTicketStep: (payload: TransitionTicketStepPayload): Promise<Ticket> =>
    rpc('ticket:transition-step', payload),

  createEntityExpense: (payload: CreateEntityExpensePayload): Promise<Ticket | Project> =>
    payload.entityType === 'ticket'
      ? rpc('ticket:create-expense', {
          ticketId: payload.entityId,
          description: payload.description,
          supplier: payload.supplier,
          quantity: payload.quantity,
          unitValue: payload.unitValue,
        })
      : rpc('project:create-expense', {
          projectId: payload.entityId,
          description: payload.description,
          supplier: payload.supplier,
          quantity: payload.quantity,
          unitValue: payload.unitValue,
        }),

  updateEntityExpense: (payload: UpdateEntityExpensePayload): Promise<Ticket | Project> =>
    payload.entityType === 'ticket'
      ? rpc('ticket:update-expense', {
          ticketId: payload.entityId,
          expenseId: payload.expenseId,
          description: payload.description,
          supplier: payload.supplier,
          quantity: payload.quantity,
          unitValue: payload.unitValue,
        })
      : rpc('project:update-expense', {
          projectId: payload.entityId,
          expenseId: payload.expenseId,
          description: payload.description,
          supplier: payload.supplier,
          quantity: payload.quantity,
          unitValue: payload.unitValue,
        }),

  deleteEntityExpense: (payload: DeleteEntityExpensePayload): Promise<Ticket | Project> =>
    payload.entityType === 'ticket'
      ? rpc('ticket:delete-expense', {
          ticketId: payload.entityId,
          expenseId: payload.expenseId,
        })
      : rpc('project:delete-expense', {
          projectId: payload.entityId,
          expenseId: payload.expenseId,
        }),

  uploadExpenseAttachment: (payload: UploadExpenseAttachmentPayload): Promise<Ticket | Project> =>
    payload.entityType === 'ticket'
      ? rpc('ticket:upload-expense-attachment', {
          ticketId: payload.entityId,
          expenseId: payload.expenseId,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64Content: payload.base64Content,
        })
      : rpc('project:upload-expense-attachment', {
          projectId: payload.entityId,
          expenseId: payload.expenseId,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64Content: payload.base64Content,
        }),

  deleteExpenseAttachment: (payload: DeleteExpenseAttachmentPayload): Promise<Ticket | Project> =>
    payload.entityType === 'ticket'
      ? rpc('ticket:delete-expense-attachment', {
          ticketId: payload.entityId,
          expenseId: payload.expenseId,
          attachmentId: payload.attachmentId,
        })
      : rpc('project:delete-expense-attachment', {
          projectId: payload.entityId,
          expenseId: payload.expenseId,
          attachmentId: payload.attachmentId,
        }),

  listEntityAttachments: (
    entityType: ExpenseEntityType,
    entityId: string,
  ): Promise<AttachmentFile[]> =>
    entityType === 'ticket'
      ? rpc('ticket:list-attachments', entityId)
      : rpc('project:list-attachments', entityId),

  uploadEntityAttachment: (payload: UploadEntityAttachmentPayload): Promise<Ticket | Project> =>
    payload.entityType === 'ticket'
      ? rpc('ticket:upload-attachment', {
          ticketId: payload.entityId,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64Content: payload.base64Content,
        })
      : rpc('project:upload-attachment', {
          projectId: payload.entityId,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64Content: payload.base64Content,
        }),

  deleteEntityAttachment: (payload: DeleteEntityAttachmentPayload): Promise<Ticket | Project> =>
    payload.entityType === 'ticket'
      ? rpc('ticket:delete-attachment', {
          ticketId: payload.entityId,
          attachmentId: payload.attachmentId,
        })
      : rpc('project:delete-attachment', {
          projectId: payload.entityId,
          attachmentId: payload.attachmentId,
        }),

  getAttachmentDownloadUrl: (payload: GetAttachmentDownloadUrlPayload): Promise<string> =>
    rpc('attachment:get-download-url', payload),

  listSlaRules: (): Promise<SlaRule[]> => rpc('sla:list'),

  createSlaRule: (payload: CreateSlaRulePayload): Promise<SlaRule> => rpc('sla:create', payload),

  updateSlaRule: (payload: UpdateSlaRulePayload): Promise<SlaRule> => rpc('sla:update', payload),

  deleteSlaRule: (ruleId: string): Promise<void> => rpc('sla:delete', ruleId),

  listWorkflows: (): Promise<Workflow[]> => rpc('workflow:list'),

  createWorkflow: (payload: CreateWorkflowPayload): Promise<Workflow> =>
    rpc('workflow:create', payload),

  updateWorkflow: (payload: UpdateWorkflowPayload): Promise<Workflow> =>
    rpc('workflow:update', payload),

  deleteWorkflow: (workflowId: string): Promise<void> => rpc('workflow:delete', workflowId),

  setDefaultWorkflow: (workflowId: string): Promise<Workflow> =>
    rpc('workflow:set-default', workflowId),

  listDiscordRules: () => rpc('discord:list-rules'),

  createDiscordRule: (payload: CreateDiscordRulePayload) => rpc('discord:create-rule', payload),

  updateDiscordRule: (payload: UpdateDiscordRulePayload) => rpc('discord:update-rule', payload),

  deleteDiscordRule: (ruleId: string) => rpc('discord:delete-rule', ruleId),

  listApiIntegrations: () => rpc('integration:list'),

  getApiIntegrationById: (integrationId: string) => rpc('integration:get-by-id', integrationId),

  createApiIntegration: (payload: CreateApiIntegrationPayload) =>
    rpc('integration:create', payload),

  updateApiIntegration: (payload: UpdateApiIntegrationPayload) =>
    rpc('integration:update', payload),

  deleteApiIntegration: (integrationId: string) => rpc('integration:delete', integrationId),

  listProjects: (): Promise<Project[]> => rpc('project:list'),

  getProjectById: (projectId: string): Promise<Project> => rpc('project:get-by-id', projectId),

  createProject: (payload: CreateProjectPayload): Promise<Project> => rpc('project:create', payload),

  updateProject: (payload: UpdateProjectPayload): Promise<Project> => rpc('project:update', payload),

  deleteProject: (projectId: string): Promise<void> => rpc('project:delete', projectId),

  createProjectTask: (payload: CreateProjectTaskPayload): Promise<Project> =>
    rpc('project:create-task', payload),

  updateProjectTask: (payload: UpdateProjectTaskPayload): Promise<Project> =>
    rpc('project:update-task', payload),

  deleteProjectTask: (payload: DeleteProjectTaskPayload): Promise<Project> =>
    rpc('project:delete-task', payload),

  createProjectTaskAppointment: (
    payload: CreateProjectTaskAppointmentPayload,
  ): Promise<ProjectTask> => rpc('project:create-task-appointment', payload),

  updateProjectTaskAppointment: (
    payload: UpdateProjectTaskAppointmentPayload,
  ): Promise<ProjectTask> => rpc('project:update-task-appointment', payload),

  deleteProjectTaskAppointment: (
    payload: DeleteProjectTaskAppointmentPayload,
  ): Promise<ProjectTask> => rpc('project:delete-task-appointment', payload),

  startTimer: (
    entityId: string,
    entityType: 'ticket' | 'project_task',
    entityTitle: string,
  ): Promise<ActiveTimer> => rpc('timer:start', entityId, entityType, entityTitle),

  pauseTimer: (timerId: string): Promise<ActiveTimer> => rpc('timer:pause', timerId),

  stopTimer: (timerId: string): Promise<Appointment> => rpc('timer:stop', timerId),

  getActiveTimers: (): Promise<ActiveTimer[]> => rpc('timer:get-active'),

  openFloatingWindow: async (): Promise<void> => {
    /* janela flutuante é exclusiva do Electron */
  },

  closeFloatingWindow: async (): Promise<void> => {
    /* janela flutuante é exclusiva do Electron */
  },

  toggleFloatingPin: async (pinned: boolean): Promise<boolean> => pinned,

  onTimerTick: (callback: (timers: ActiveTimer[]) => void): (() => void) => {
    const intervalId = window.setInterval(() => {
      if (!getBrowserAuthToken()) return
      rpc<ActiveTimer[]>('timer:get-active')
        .then(callback)
        .catch(() => {})
    }, 1000)
    return () => window.clearInterval(intervalId)
  },
}
