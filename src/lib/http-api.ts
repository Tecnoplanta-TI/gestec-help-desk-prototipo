/**
 * Cliente HTTP para o renderer no navegador — espelha window.electronAPI via POST /api/rpc
 */

import type {
  ActiveTimer,
  Appointment,
  AttachmentFile,
  ApproveCompletionPayload,
  ApproveTicketPayload,
  AddTicketCommentPayload,
  AppConfig,
  AuditLog,
  CompleteTicketServicePayload,
  CreateCostCenterPayload,
  CreateDiscordRulePayload,
  CreateEntityExpensePayload,
  CreateProjectPayload,
  CreateProjectTaskAppointmentPayload,
  CreateProjectTaskPayload,
  CreateSlaRulePayload,
  CreateTicketAppointmentPayload,
  CreateTicketPayload,
  CreateTicketTaskPayload,
  CreateUserPayload,
  CreateWorkflowPayload,
  CostCenter,
  DeleteEntityAttachmentPayload,
  DeleteEntityExpensePayload,
  DeleteExpenseAttachmentPayload,
  DeleteProjectTaskAppointmentPayload,
  DeleteProjectTaskPayload,
  DeleteTicketAppointmentPayload,
  DiscordNotificationRule,
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
  UpdateDiscordRulePayload,
  UpdateEntityExpensePayload,
  UpdateProjectPayload,
  UpdateProjectTaskAppointmentPayload,
  UpdateProjectTaskPayload,
  UpdateSlaRulePayload,
  UpdateServiceTicketPayload,
  UpdateTicketPayload,
  UpdateTicketTaskPayload,
  UpdateUserPayload,
  UpdateWorkflowPayload,
  UploadEntityAttachmentPayload,
  UploadExpenseAttachmentPayload,
  User,
  Workflow,
} from '../../shared/types'

const TOKEN_KEY = 'gestec.accessToken'

export function getAccessToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token: string | null): void {
  if (typeof sessionStorage === 'undefined') return
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  else sessionStorage.removeItem(TOKEN_KEY)
}

async function rpc<T>(channel: string, ...args: unknown[]): Promise<T> {
  const token = getAccessToken()
  const response = await fetch('/api/rpc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ channel, args }),
  })

  const body = (await response.json()) as { data?: T; code?: string; message?: string }

  if (!response.ok) {
    const code = body.code ?? 'INTERNAL_ERROR'
    const message = body.message ?? code
    throw Object.assign(new Error(message), { code })
  }

  return body.data as T
}

export const httpApi: ElectronAPI = {
  login: async (email, password) => {
    const result = await rpc<LoginResult>('auth:login', email, password)
    if (result.accessToken) setAccessToken(result.accessToken)
    return result
  },

  logout: async () => {
    await rpc('auth:logout')
    setAccessToken(null)
  },

  getSession: async () => {
    const result = await rpc<LoginResult | null>('auth:get-session')
    if (result?.accessToken) setAccessToken(result.accessToken)
    return result
  },

  listUsers: () => rpc<User[]>('auth:list-users'),
  createUser: (payload) => rpc<User>('auth:create-user', payload),
  updateUser: (payload) => rpc<User>('auth:update-user', payload),
  resetPassword: (payload) => rpc<void>('auth:reset-password', payload),
  toggleUserActive: (payload) => rpc<User>('auth:toggle-user-active', payload),

  listTickets: (filter) =>
    filter ? rpc<Ticket[]>('ticket:list-filtered', filter) : rpc<Ticket[]>('ticket:list'),

  getTicketById: (ticketId) => rpc<Ticket>('ticket:get-by-id', ticketId),
  createTicket: (payload) => rpc<Ticket>('ticket:create', payload),
  updateTicket: (payload) => rpc<Ticket>('ticket:update', payload),
  approveTicket: (payload) => rpc<Ticket>('ticket:approve', payload),
  triageTicket: (payload) => rpc<Ticket>('ticket:triage', payload),
  startTicketService: (ticketId) => rpc<Ticket>('ticket:start-service', ticketId),
  completeTicketService: (payload) => rpc<Ticket>('ticket:complete-service', payload),
  updateServiceTicket: (payload) => rpc<Ticket>('ticket:update-service', payload),
  approveTicketCompletion: (payload) => rpc<Ticket>('ticket:approve-completion', payload),
  submitTicketEvaluation: (payload) => rpc<Ticket>('ticket:submit-evaluation', payload),
  createTicketTask: (payload) => rpc<Ticket>('ticket:create-task', payload),
  updateTicketTask: (payload) => rpc<Ticket>('ticket:update-task', payload),
  createTicketAppointment: (payload) => rpc<Ticket>('ticket:create-appointment', payload),
  deleteTicketAppointment: (payload) => rpc<Ticket>('ticket:delete-appointment', payload),
  addTicketComment: (payload) => rpc<Ticket>('ticket:add-comment', payload),
  listAuditLogs: (entityId) => rpc<AuditLog[]>('audit:list', entityId),
  listCostCenters: () => rpc<CostCenter[]>('cost-center:list'),
  createCostCenter: (payload) => rpc<CostCenter>('cost-center:create', payload),
  updateCostCenter: (payload) => rpc<CostCenter>('cost-center:update', payload),
  getAppConfig: () => rpc<AppConfig>('app-config:get'),
  updateAppConfig: (payload) => rpc<AppConfig>('app-config:update', payload),
  getTicketReportStats: () => rpc<TicketReportStats>('reports:ticket-stats'),
  transitionTicketStep: (payload) => rpc<Ticket>('ticket:transition-step', payload),

  createEntityExpense: (payload) =>
    payload.entityType === 'ticket'
      ? rpc<Ticket>('ticket:create-expense', {
          ticketId: payload.entityId,
          description: payload.description,
          supplier: payload.supplier,
          quantity: payload.quantity,
          unitValue: payload.unitValue,
        })
      : rpc<Project>('project:create-expense', {
          projectId: payload.entityId,
          description: payload.description,
          supplier: payload.supplier,
          quantity: payload.quantity,
          unitValue: payload.unitValue,
        }),

  updateEntityExpense: (payload) =>
    payload.entityType === 'ticket'
      ? rpc<Ticket>('ticket:update-expense', {
          ticketId: payload.entityId,
          expenseId: payload.expenseId,
          description: payload.description,
          supplier: payload.supplier,
          quantity: payload.quantity,
          unitValue: payload.unitValue,
        })
      : rpc<Project>('project:update-expense', {
          projectId: payload.entityId,
          expenseId: payload.expenseId,
          description: payload.description,
          supplier: payload.supplier,
          quantity: payload.quantity,
          unitValue: payload.unitValue,
        }),

  deleteEntityExpense: (payload) =>
    payload.entityType === 'ticket'
      ? rpc<Ticket>('ticket:delete-expense', {
          ticketId: payload.entityId,
          expenseId: payload.expenseId,
        })
      : rpc<Project>('project:delete-expense', {
          projectId: payload.entityId,
          expenseId: payload.expenseId,
        }),

  uploadExpenseAttachment: (payload) =>
    payload.entityType === 'ticket'
      ? rpc<Ticket>('ticket:upload-expense-attachment', {
          ticketId: payload.entityId,
          expenseId: payload.expenseId,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64Content: payload.base64Content,
        })
      : rpc<Project>('project:upload-expense-attachment', {
          projectId: payload.entityId,
          expenseId: payload.expenseId,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64Content: payload.base64Content,
        }),

  deleteExpenseAttachment: (payload) =>
    payload.entityType === 'ticket'
      ? rpc<Ticket>('ticket:delete-expense-attachment', {
          ticketId: payload.entityId,
          expenseId: payload.expenseId,
          attachmentId: payload.attachmentId,
        })
      : rpc<Project>('project:delete-expense-attachment', {
          projectId: payload.entityId,
          expenseId: payload.expenseId,
          attachmentId: payload.attachmentId,
        }),

  listEntityAttachments: (entityType, entityId) =>
    entityType === 'ticket'
      ? rpc<AttachmentFile[]>('ticket:list-attachments', entityId)
      : rpc<AttachmentFile[]>('project:list-attachments', entityId),

  uploadEntityAttachment: (payload) =>
    payload.entityType === 'ticket'
      ? rpc<Ticket>('ticket:upload-attachment', {
          ticketId: payload.entityId,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64Content: payload.base64Content,
        })
      : rpc<Project>('project:upload-attachment', {
          projectId: payload.entityId,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64Content: payload.base64Content,
        }),

  deleteEntityAttachment: (payload) =>
    payload.entityType === 'ticket'
      ? rpc<Ticket>('ticket:delete-attachment', {
          ticketId: payload.entityId,
          attachmentId: payload.attachmentId,
        })
      : rpc<Project>('project:delete-attachment', {
          projectId: payload.entityId,
          attachmentId: payload.attachmentId,
        }),

  getAttachmentDownloadUrl: (payload) =>
    rpc<string>('attachment:get-download-url', payload),

  listSlaRules: () => rpc<SlaRule[]>('sla:list'),
  createSlaRule: (payload) => rpc<SlaRule>('sla:create', payload),
  updateSlaRule: (payload) => rpc<SlaRule>('sla:update', payload),
  deleteSlaRule: (ruleId) => rpc<void>('sla:delete', ruleId),

  listWorkflows: () => rpc<Workflow[]>('workflow:list'),
  createWorkflow: (payload) => rpc<Workflow>('workflow:create', payload),
  updateWorkflow: (payload) => rpc<Workflow>('workflow:update', payload),
  deleteWorkflow: (workflowId) => rpc<void>('workflow:delete', workflowId),
  setDefaultWorkflow: (workflowId) => rpc<Workflow>('workflow:set-default', workflowId),

  listDiscordRules: () => rpc<DiscordNotificationRule[]>('discord:list-rules'),
  createDiscordRule: (payload) => rpc<DiscordNotificationRule>('discord:create-rule', payload),
  updateDiscordRule: (payload) => rpc<DiscordNotificationRule>('discord:update-rule', payload),
  deleteDiscordRule: (ruleId) => rpc<void>('discord:delete-rule', ruleId),

  listProjects: () => rpc<Project[]>('project:list'),
  getProjectById: (projectId) => rpc<Project>('project:get-by-id', projectId),
  createProject: (payload) => rpc<Project>('project:create', payload),
  updateProject: (payload) => rpc<Project>('project:update', payload),
  deleteProject: (projectId) => rpc<void>('project:delete', projectId),
  createProjectTask: (payload) => rpc<Project>('project:create-task', payload),
  updateProjectTask: (payload) => rpc<Project>('project:update-task', payload),
  deleteProjectTask: (payload) => rpc<Project>('project:delete-task', payload),
  createProjectTaskAppointment: (payload) =>
    rpc<ProjectTask>('project:create-task-appointment', payload),
  updateProjectTaskAppointment: (payload) =>
    rpc<ProjectTask>('project:update-task-appointment', payload),
  deleteProjectTaskAppointment: (payload) =>
    rpc<ProjectTask>('project:delete-task-appointment', payload),

  startTimer: (entityId, entityType, entityTitle) =>
    rpc<ActiveTimer>('timer:start', entityId, entityType, entityTitle),
  pauseTimer: (timerId) => rpc<ActiveTimer>('timer:pause', timerId),
  stopTimer: (timerId) => rpc<Appointment>('timer:stop', timerId),
  getActiveTimers: () => rpc<ActiveTimer[]>('timer:get-active'),

  openFloatingWindow: async () => undefined,
  closeFloatingWindow: async () => undefined,
  toggleFloatingPin: async (pinned) => pinned,

  onTimerTick: (callback) => {
    const id = window.setInterval(() => {
      rpc<ActiveTimer[]>('timer:get-active')
        .then(callback)
        .catch(() => undefined)
    }, 1000)
    return () => window.clearInterval(id)
  },
}
