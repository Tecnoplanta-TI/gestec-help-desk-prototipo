/**
 * shared/types/index.ts
 *
 * Tipos compartilhados entre Main Process (Electron) e Renderer Process (React).
 * Importados via alias @shared/* em ambos os lados.
 *
 * Regra: NUNCA importar aqui tipos específicos de Node.js ou do browser —
 * este arquivo deve ser agnóstico de ambiente.
 */

// ─── Enums / Literais ────────────────────────────────────────────────────────

export type UserRole = 'member' | 'manager' | 'admin'

export type TicketSource = 'external' | 'manual'

export type TicketType =
  | 'incident'
  | 'service_interruption'
  | 'improvement'
  | 'request'
  | 'cancellation'

export type TicketService = 'infrastructure' | 'system'

export type UnavailableSystem =
  | '3cx'
  | 'ecommerce'
  | 'insoft'
  | 'kinghost'
  | 'other'
  | 'pdv_siger'
  | 'siger'

export type InoperableInfrastructure =
  | 'internet'
  | 'other'
  | 'network'
  | 'time_clocks'
  | 'local_server'
  | 'ts'
  | 'vm'
  | 'vpn'

export type TicketTaskStatus = 'pending' | 'done' | 'cancelled'

export type CancellationItemStatus = 'pending' | 'approved' | 'rejected'

export type TicketQueue =
  | 'all'
  | 'mine'
  | 'triage'
  | 'service'
  | 'completion'
  | 'approvals_it'
  | 'approvals_app'
  | 'cancellation'

export type TicketListScope = 'mine' | 'participated' | 'accessible'

export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4'

export type TicketLevel = 'N1' | 'N2' | 'N3'

export type ServiceGroup =
  | 'access_accounts'
  | 'acquisitions'
  | 'dashboards'
  | 'emails'
  | 'gestec'
  | 'printers'
  | 'maintenance_upgrade'
  | 'software'
  | 'network_internet'
  | 'erp'
  | 'process_platform'
  | 'other'

export type SlaStatus = 'ok' | 'warning' | 'overdue'

export type AppointmentOrigin = 'timer' | 'manual'
export type ExpenseEntityType = 'ticket' | 'project'

export type TimerState = 'running' | 'paused' | 'stopped'

export type WorkflowStepType = 'manual' | 'approval' | 'automatic'

export type DiscordTriggerEvent =
  | 'ticket_created'
  | 'ticket_status_changed'
  | 'ticket_assigned'
  | 'ticket_sla_warning'
  | 'ticket_sla_overdue'
  | 'ticket_closed'

// ─── Usuário ─────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  permissions: string[]
  createdAt: string
  updatedAt: string
}

// ─── Payloads de autenticação / usuários ──────────────────────────────────────

export interface LoginResult {
  user: User
  expiresAt: string // ISO datetime
  /** JWT retornado no login (modo navegador) */
  token?: string
}

export interface CreateUserPayload {
  name: string
  email: string
  role: UserRole
  password: string
}

export interface UpdateUserPayload {
  id: string
  name?: string
  email?: string
  role?: UserRole
}

export interface ResetPasswordPayload {
  userId: string
  newPassword: string
}

export interface ToggleUserActivePayload {
  userId: string
  active: boolean
}

export interface TicketCancellationItem {
  id: string
  zeevRequestNumber: string
  justification?: string
  status: CancellationItemStatus
  processedAt?: string
}

export interface TicketTask {
  id: string
  description: string
  assigneeId?: string
  assigneeCode?: string
  dueDate: string
  status: TicketTaskStatus
  createdAt: string
  updatedAt: string
}

export interface ApprovalDecision {
  approved: boolean
  justification?: string
  decidedBy: string
  decidedAt: string
}

export interface TicketComment {
  id: string
  authorId: string
  body: string
  isInternal: boolean
  createdAt: string
}

export interface DeliveredEquipmentItem {
  id: string
  assetId: string
  description: string
}

export interface AuditLog {
  id: string
  entityType: 'ticket' | 'user'
  entityId: string
  action: string
  field?: string
  oldValue?: string
  newValue?: string
  userId: string
  workflowStep?: string
  justification?: string
  createdAt: string
}

export interface AppConfig {
  id: 'default'
  npsLowScoreThreshold: number
  adjustmentTimeoutDays: number
  adjustmentTimeoutEnabled: boolean
  defaultTriageAssigneeId?: string
  defaultCancellationApproverId?: string
  emailEnabled: boolean
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpFrom?: string
  updatedAt: string
}

export interface CreateTicketPayload {
  title: string
  description: string
  requesterName: string
  requesterEmail?: string
  requesterUserId?: string
  costCenter: string
  type: TicketType
  priority: TicketPriority
  serviceGroup: ServiceGroup
  service?: TicketService
  unavailableSystem?: UnavailableSystem
  inoperableInfrastructure?: InoperableInfrastructure
  applicationProcess?: string
  improvementAcknowledged?: boolean
  appManagerId?: string
  assetCode?: string
  supportNotes?: string
  level?: TicketLevel
  downtimeMinutes?: number
  cancellationItems?: Array<{ zeevRequestNumber: string; justification?: string }>
  cancellationApproverId?: string
  directCancellation?: boolean
}

export interface UpdateTicketPayload {
  ticketId: string
  title?: string
  description?: string
  priority?: TicketPriority
  service?: TicketService
  unavailableSystem?: UnavailableSystem
  inoperableInfrastructure?: InoperableInfrastructure
  applicationProcess?: string
  assetCode?: string
  supportNotes?: string
  level?: TicketLevel
  downtimeMinutes?: number
  expectedUpdatedAt?: string
}

export interface ApproveTicketPayload {
  ticketId: string
  approved: boolean
  justification?: string
  stage: 'it_manager' | 'app_manager' | 'cancellation'
}

export interface TriageTicketPayload {
  ticketId: string
  decision: 'approve' | 'reject' | 'adjustment'
  assigneeId?: string
  justification?: string
  costCenter?: string
  type?: TicketType
  priority?: TicketPriority
  level?: TicketLevel
  serviceGroup?: ServiceGroup
}

export interface CreateTicketTaskPayload {
  ticketId: string
  description: string
  assigneeId?: string
  dueDate: string
}

export interface UpdateTicketTaskPayload {
  ticketId: string
  taskId: string
  description?: string
  assigneeId?: string | null
  dueDate?: string
  status?: TicketTaskStatus
}

export interface CreateTicketAppointmentPayload {
  ticketId: string
  date: string
  startTime: string
  endTime: string
  note?: string
  technicianId?: string
}

export interface DeleteTicketAppointmentPayload {
  ticketId: string
  appointmentId: string
}

export interface UpdateServiceTicketPayload {
  ticketId: string
  costCenter?: string
  priority?: TicketPriority
  level?: TicketLevel
  serviceGroup?: ServiceGroup
  serviceDueDate?: string
  additionalAssigneeId?: string | null
  supportNotes?: string
  deliveredEquipment?: DeliveredEquipmentItem[]
  createZeevUser?: boolean
  createEmail?: boolean
  facilitatorChecklist?: string
  securitySealChanged?: boolean
  securitySealCode?: string
  newSecuritySealCode?: string
}

export interface ApproveCompletionPayload {
  ticketId: string
  approved: boolean
  justification?: string
}

export interface CompleteTicketServicePayload {
  ticketId: string
  resolutionSummary?: string
  deliveredEquipment?: DeliveredEquipmentItem[]
}

export interface AddTicketCommentPayload {
  ticketId: string
  body: string
  isInternal?: boolean
}

export interface SubmitTicketEvaluationPayload {
  ticketId: string
  metExpectation: boolean
  score: number
  expectation?: string
  feedback?: string
  npsJustification?: string
}

export interface ListTicketsFilterPayload {
  queue?: TicketQueue
  /** Escopo de visibilidade na listagem geral (estilo Zeev "Acompanhar solicitação"). */
  scope?: TicketListScope
}

export interface CreateCostCenterPayload {
  code: string
  name: string
}

export interface UpdateCostCenterPayload {
  id: string
  code?: string
  name?: string
  active?: boolean
}

export interface CreateSlaRulePayload {
  name: string
  priority?: TicketPriority
  serviceGroup?: ServiceGroup
  deadlineHours: number
}

export interface UpdateSlaRulePayload {
  id: string
  name?: string
  priority?: TicketPriority | null
  serviceGroup?: ServiceGroup | null
  deadlineHours?: number
}

export interface WorkflowStepInput {
  id?: string
  name: string
  type: WorkflowStepType
  defaultAssigneeId?: string
  slaHours?: number
  order: number
}

export interface WorkflowTransitionInput {
  id?: string
  fromStepId: string
  toStepId: string
  conditions: WorkflowCondition[]
}

export interface CreateWorkflowPayload {
  name: string
  description?: string
  isDefault?: boolean
  steps: WorkflowStepInput[]
  transitions: WorkflowTransitionInput[]
}

export interface UpdateWorkflowPayload {
  id: string
  name?: string
  description?: string
  isDefault?: boolean
  steps?: WorkflowStepInput[]
  transitions?: WorkflowTransitionInput[]
}

export interface TransitionTicketStepPayload {
  ticketId: string
  toStepId: string
}

export interface CreateDiscordRulePayload {
  name: string
  webhookUrl: string
  triggerOn: DiscordTriggerEvent
  conditions: DiscordCondition[]
  messageTemplate: string
  active: boolean
}

export interface UpdateDiscordRulePayload {
  id: string
  name?: string
  webhookUrl?: string
  triggerOn?: DiscordTriggerEvent
  conditions?: DiscordCondition[]
  messageTemplate?: string
  active?: boolean
}

export interface CreateProjectPayload {
  name: string
  description?: string
  costCenter: string
  hourlyRate: number
}

export interface UpdateProjectPayload {
  id: string
  name?: string
  description?: string
  costCenter?: string
  hourlyRate?: number
  expectedUpdatedAt?: string
}

export interface CreateProjectTaskPayload {
  projectId: string
  title: string
  description?: string
  assigneeId?: string
  expectedProjectUpdatedAt?: string
}

export interface UpdateProjectTaskPayload {
  projectId: string
  taskId: string
  title?: string
  description?: string
  assigneeId?: string | null
  expectedProjectUpdatedAt?: string
}

export interface DeleteProjectTaskPayload {
  projectId: string
  taskId: string
  expectedProjectUpdatedAt?: string
}

export interface CreateProjectTaskAppointmentPayload {
  projectId: string
  taskId: string
  date: string
  startTime: string
  endTime: string
  totalMinutes: number
  note?: string
  expectedProjectUpdatedAt?: string
}

export interface UpdateProjectTaskAppointmentPayload {
  projectId: string
  taskId: string
  appointmentId: string
  date?: string
  startTime?: string
  endTime?: string
  totalMinutes?: number
  note?: string
  expectedProjectUpdatedAt?: string
}

export interface DeleteProjectTaskAppointmentPayload {
  projectId: string
  taskId: string
  appointmentId: string
  expectedProjectUpdatedAt?: string
}

// ─── Ticket ──────────────────────────────────────────────────────────────────

export interface TicketRequester {
  name: string
  email: string
  costCenter: string
}

export interface TicketEvaluation {
  metExpectation: boolean
  score: number // 1–10
  expectation?: string // preenchido se metExpectation = false
  feedback?: string
  npsJustification?: string // preenchido se score <= 6
}

/** Um registro de trabalho gerado pelo cronômetro ou lançado manualmente */
export interface Appointment {
  id: string
  date: string // ISO date "YYYY-MM-DD"
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
  totalMinutes: number
  technicianId: string
  origin: AppointmentOrigin
  note?: string
}

export interface AttachmentFile {
  id: string
  fileName: string
  blobKey: string
  mimeType: string
  size: number
  uploadedBy: string
  uploadedAt: string
}

export interface Expense {
  id: string
  description: string
  supplier?: string
  quantity: number
  unitValue: number
  totalValue: number
  receiptFiles: AttachmentFile[]
  createdAt: string
  updatedAt: string
}

export interface TicketSla {
  deadline?: string // ISO datetime
  firstContactAt?: string
  resolvedAt?: string
  status: SlaStatus
}

export interface Ticket {
  id: string
  ticketNumber?: string
  openedAt?: string
  externalId?: string // ID na plataforma externa (legado)
  source: TicketSource
  title: string
  description: string
  requester: TicketRequester
  requesterUserId?: string
  type: TicketType
  priority: TicketPriority
  serviceGroup: ServiceGroup
  service?: TicketService
  unavailableSystem?: UnavailableSystem
  inoperableInfrastructure?: InoperableInfrastructure
  applicationProcess?: string
  improvementAcknowledged?: boolean
  appManagerId?: string
  appManagerCode?: string
  triageAssigneeId?: string
  isCancelled?: boolean
  cancellationItems?: TicketCancellationItem[]
  cancellationApproverId?: string
  directCancellation?: boolean
  itManagerDecision?: ApprovalDecision
  appManagerDecision?: ApprovalDecision
  cancellationDecision?: ApprovalDecision
  adjustmentRequestedAt?: string
  adjustmentDeadline?: string
  status: string // step ID do workflow
  workflowId: string
  assigneeId?: string
  additionalAssigneeId?: string
  serviceDueDate?: string
  deliveredEquipment?: DeliveredEquipmentItem[]
  createZeevUser?: boolean
  createEmail?: boolean
  facilitatorChecklist?: string
  securitySealChanged?: boolean
  // Campos internos TI
  level?: TicketLevel
  assetCode?: string
  securitySealCode?: string
  newSecuritySealCode?: string
  supportNotes?: string
  downtimeMinutes?: number
  initialContactSkipped?: boolean
  // Registros
  tasks?: TicketTask[]
  comments?: TicketComment[]
  appointments: Appointment[]
  expenses: Expense[]
  attachments: AttachmentFile[]
  workflowHistory?: WorkflowHistoryEntry[]
  sla: TicketSla
  evaluation?: TicketEvaluation
  createdAt: string
  updatedAt: string
}

export interface WorkflowHistoryEntry {
  id: string
  fromStepId: string
  toStepId: string
  changedBy: string
  changedAt: string
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

export interface WorkflowCondition {
  field: string // ex: "type", "priority", "serviceGroup"
  operator: 'equal' | 'not_equal' | 'in' | 'not_in'
  value: string | string[]
}

export interface WorkflowTransition {
  id: string
  fromStepId: string
  toStepId: string
  conditions: WorkflowCondition[]
}

export interface WorkflowStep {
  id: string
  name: string
  type: WorkflowStepType
  defaultAssigneeId?: string
  slaHours?: number // SLA opcional por etapa
  order: number
}

export interface Workflow {
  id: string
  name: string
  description?: string
  isDefault: boolean
  steps: WorkflowStep[]
  transitions: WorkflowTransition[]
  createdAt: string
  updatedAt: string
}

// ─── SLA ─────────────────────────────────────────────────────────────────────

export interface SlaRule {
  id: string
  name: string
  priority?: TicketPriority
  serviceGroup?: ServiceGroup
  deadlineHours: number
  createdAt: string
  updatedAt: string
}

// ─── Projetos ─────────────────────────────────────────────────────────────────

export interface ProjectTask {
  id: string
  title: string
  description?: string
  assigneeId?: string
  appointments: Appointment[]
  expenses: Expense[]
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  description?: string
  costCenter: string
  hourlyRate: number
  tasks: ProjectTask[]
  expenses: Expense[]
  attachments: AttachmentFile[]
  createdAt: string
  updatedAt: string
}

export interface CreateEntityExpensePayload {
  entityType: ExpenseEntityType
  entityId: string
  description: string
  supplier?: string
  quantity: number
  unitValue: number
}

export interface UpdateEntityExpensePayload {
  entityType: ExpenseEntityType
  entityId: string
  expenseId: string
  description?: string
  supplier?: string
  quantity?: number
  unitValue?: number
}

export interface DeleteEntityExpensePayload {
  entityType: ExpenseEntityType
  entityId: string
  expenseId: string
}

export interface UploadExpenseAttachmentPayload {
  entityType: ExpenseEntityType
  entityId: string
  expenseId: string
  fileName: string
  mimeType: string
  base64Content: string
}

export interface DeleteExpenseAttachmentPayload {
  entityType: ExpenseEntityType
  entityId: string
  expenseId: string
  attachmentId: string
}

export interface UploadEntityAttachmentPayload {
  entityType: ExpenseEntityType
  entityId: string
  fileName: string
  mimeType: string
  base64Content: string
}

export interface DeleteEntityAttachmentPayload {
  entityType: ExpenseEntityType
  entityId: string
  attachmentId: string
}

export interface GetAttachmentDownloadUrlPayload {
  blobKey: string
}

// ─── Valor Hora ───────────────────────────────────────────────────────────────

export interface HourlyRate {
  id: string
  name: string
  type: 'ticket' | 'project'
  serviceGroup?: ServiceGroup
  projectId?: string
  ratePerHour: number
  currency: 'BRL'
}

// ─── Centro de Custo ─────────────────────────────────────────────────────────

export interface CostCenter {
  id: string
  code: string
  name: string
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface TicketReportStats {
  totalOpen: number
  byType: Record<string, number>
  byPriority: Record<string, number>
  byStatus: Record<string, number>
  averageScore: number | null
  evaluationCount: number
}

// ─── Integrações API ───────────────────────────────────────────────────────────

export type ApiIntegrationMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type ApiIntegrationKind = 'rest_json' | 'sql' | 'fixed'
export type ApiIntegrationAuthType = 'none' | 'bearer'

export interface ApiIntegrationKeyValue {
  key: string
  value: string
}

export interface ApiIntegration {
  id: string
  name: string
  kind: ApiIntegrationKind
  method: ApiIntegrationMethod
  url: string
  body?: string
  authType: ApiIntegrationAuthType
  authToken?: string
  parameters: ApiIntegrationKeyValue[]
  headers: ApiIntegrationKeyValue[]
  transformFilter?: string
  transformValue?: string
  transformText?: string
  transformSort?: string
  transformErrorMessage?: string
  transformFriendlyMessage?: string
  accessoryFields: ApiIntegrationKeyValue[]
  locked?: boolean
  createdById: string
  createdByName: string
  createdAt: string
  updatedAt: string
}

export interface CreateApiIntegrationPayload {
  name: string
  kind?: ApiIntegrationKind
  method: ApiIntegrationMethod
  url: string
  body?: string
  authType?: ApiIntegrationAuthType
  authToken?: string
  parameters?: ApiIntegrationKeyValue[]
  headers?: ApiIntegrationKeyValue[]
  transformFilter?: string
  transformValue?: string
  transformText?: string
  transformSort?: string
  transformErrorMessage?: string
  transformFriendlyMessage?: string
  accessoryFields?: ApiIntegrationKeyValue[]
  locked?: boolean
}

export interface UpdateApiIntegrationPayload extends Partial<CreateApiIntegrationPayload> {
  id: string
}

// ─── Notificações Discord ─────────────────────────────────────────────────────

export interface DiscordCondition {
  field: string
  operator: 'equal' | 'not_equal' | 'in' | 'contains'
  value: string | string[]
}

export interface DiscordNotificationRule {
  id: string
  name: string
  webhookUrl: string
  triggerOn: DiscordTriggerEvent
  conditions: DiscordCondition[]
  /** Template com placeholders: {ticket.priority}, {requester.name}, etc. */
  messageTemplate: string
  active: boolean
  createdAt: string
  updatedAt: string
}

// ─── Cronômetro (estado em tempo real) ───────────────────────────────────────

export interface ActiveTimer {
  id: string
  /** ID do ticket ou tarefa de projeto associado */
  entityId: string
  entityType: 'ticket' | 'project_task'
  entityTitle: string
  state: TimerState
  startedAt: string // ISO datetime do início da sessão atual
  accumulatedSeconds: number // segundos acumulados em sessões anteriores (pausas)
  technicianId: string
}

// ─── IPC — contrato tipado entre Main e Renderer ─────────────────────────────

export interface ElectronAPI {
  // Auth
  login: (email: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
  getSession: () => Promise<LoginResult | null>
  // Gestão de usuários (admin)
  listUsers: () => Promise<User[]>
  createUser: (payload: CreateUserPayload) => Promise<User>
  updateUser: (payload: UpdateUserPayload) => Promise<User>
  resetPassword: (payload: ResetPasswordPayload) => Promise<void>
  toggleUserActive: (payload: ToggleUserActivePayload) => Promise<User>
  // Tickets
  listTickets: (filter?: ListTicketsFilterPayload) => Promise<Ticket[]>
  getTicketById: (ticketId: string) => Promise<Ticket>
  createTicket: (payload: CreateTicketPayload) => Promise<Ticket>
  updateTicket: (payload: UpdateTicketPayload) => Promise<Ticket>
  approveTicket: (payload: ApproveTicketPayload) => Promise<Ticket>
  triageTicket: (payload: TriageTicketPayload) => Promise<Ticket>
  startTicketService: (ticketId: string) => Promise<Ticket>
  skipTicketInitialContact: (ticketId: string) => Promise<Ticket>
  completeTicketService: (payload: CompleteTicketServicePayload) => Promise<Ticket>
  updateServiceTicket: (payload: UpdateServiceTicketPayload) => Promise<Ticket>
  approveTicketCompletion: (payload: ApproveCompletionPayload) => Promise<Ticket>
  submitTicketEvaluation: (payload: SubmitTicketEvaluationPayload) => Promise<Ticket>
  createTicketTask: (payload: CreateTicketTaskPayload) => Promise<Ticket>
  updateTicketTask: (payload: UpdateTicketTaskPayload) => Promise<Ticket>
  createTicketAppointment: (payload: CreateTicketAppointmentPayload) => Promise<Ticket>
  deleteTicketAppointment: (payload: DeleteTicketAppointmentPayload) => Promise<Ticket>
  addTicketComment: (payload: AddTicketCommentPayload) => Promise<Ticket>
  listAuditLogs: (entityId: string) => Promise<AuditLog[]>
  listCostCenters: () => Promise<CostCenter[]>
  createCostCenter: (payload: CreateCostCenterPayload) => Promise<CostCenter>
  updateCostCenter: (payload: UpdateCostCenterPayload) => Promise<CostCenter>
  getAppConfig: () => Promise<AppConfig>
  updateAppConfig: (payload: Partial<Omit<AppConfig, 'id'>>) => Promise<AppConfig>
  getTicketReportStats: () => Promise<TicketReportStats>
  createEntityExpense: (payload: CreateEntityExpensePayload) => Promise<Ticket | Project>
  updateEntityExpense: (payload: UpdateEntityExpensePayload) => Promise<Ticket | Project>
  deleteEntityExpense: (payload: DeleteEntityExpensePayload) => Promise<Ticket | Project>
  uploadExpenseAttachment: (payload: UploadExpenseAttachmentPayload) => Promise<Ticket | Project>
  deleteExpenseAttachment: (payload: DeleteExpenseAttachmentPayload) => Promise<Ticket | Project>
  listEntityAttachments: (entityType: ExpenseEntityType, entityId: string) => Promise<AttachmentFile[]>
  uploadEntityAttachment: (payload: UploadEntityAttachmentPayload) => Promise<Ticket | Project>
  deleteEntityAttachment: (payload: DeleteEntityAttachmentPayload) => Promise<Ticket | Project>
  getAttachmentDownloadUrl: (payload: GetAttachmentDownloadUrlPayload) => Promise<string>
  // SLA
  listSlaRules: () => Promise<SlaRule[]>
  createSlaRule: (payload: CreateSlaRulePayload) => Promise<SlaRule>
  updateSlaRule: (payload: UpdateSlaRulePayload) => Promise<SlaRule>
  deleteSlaRule: (ruleId: string) => Promise<void>
  // Workflow
  listWorkflows: () => Promise<Workflow[]>
  createWorkflow: (payload: CreateWorkflowPayload) => Promise<Workflow>
  updateWorkflow: (payload: UpdateWorkflowPayload) => Promise<Workflow>
  deleteWorkflow: (workflowId: string) => Promise<void>
  setDefaultWorkflow: (workflowId: string) => Promise<Workflow>
  transitionTicketStep: (payload: TransitionTicketStepPayload) => Promise<Ticket>
  // Discord
  listDiscordRules: () => Promise<DiscordNotificationRule[]>
  createDiscordRule: (payload: CreateDiscordRulePayload) => Promise<DiscordNotificationRule>
  updateDiscordRule: (payload: UpdateDiscordRulePayload) => Promise<DiscordNotificationRule>
  deleteDiscordRule: (ruleId: string) => Promise<void>
  // Integrações API
  listApiIntegrations: () => Promise<ApiIntegration[]>
  getApiIntegrationById: (integrationId: string) => Promise<ApiIntegration>
  createApiIntegration: (payload: CreateApiIntegrationPayload) => Promise<ApiIntegration>
  updateApiIntegration: (payload: UpdateApiIntegrationPayload) => Promise<ApiIntegration>
  deleteApiIntegration: (integrationId: string) => Promise<void>
  // Projects
  listProjects: () => Promise<Project[]>
  getProjectById: (projectId: string) => Promise<Project>
  createProject: (payload: CreateProjectPayload) => Promise<Project>
  updateProject: (payload: UpdateProjectPayload) => Promise<Project>
  deleteProject: (projectId: string) => Promise<void>
  createProjectTask: (payload: CreateProjectTaskPayload) => Promise<Project>
  updateProjectTask: (payload: UpdateProjectTaskPayload) => Promise<Project>
  deleteProjectTask: (payload: DeleteProjectTaskPayload) => Promise<Project>
  createProjectTaskAppointment: (payload: CreateProjectTaskAppointmentPayload) => Promise<ProjectTask>
  updateProjectTaskAppointment: (payload: UpdateProjectTaskAppointmentPayload) => Promise<ProjectTask>
  deleteProjectTaskAppointment: (payload: DeleteProjectTaskAppointmentPayload) => Promise<ProjectTask>
  // Timers
  startTimer: (entityId: string, entityType: ActiveTimer['entityType'], entityTitle: string) => Promise<ActiveTimer>
  pauseTimer: (timerId: string) => Promise<ActiveTimer>
  stopTimer: (timerId: string) => Promise<Appointment>
  getActiveTimers: () => Promise<ActiveTimer[]>
  // Janela flutuante
  openFloatingWindow: () => Promise<void>
  closeFloatingWindow: () => Promise<void>
  toggleFloatingPin: (pinned: boolean) => Promise<boolean>
  // Eventos Main → Renderer
  onTimerTick: (callback: (timers: ActiveTimer[]) => void) => () => void
}
