/**
 * electron/preload.ts — Preload Script (Context Bridge)
 *
 * Este arquivo roda em um contexto privilegiado (acesso limitado ao Node.js),
 * mas é carregado ANTES do código do Renderer (React).
 *
 * Segurança:
 * - Expõe APENAS o necessário via contextBridge.exposeInMainWorld
 * - Nenhum objeto Node.js (require, fs, process) é exposto ao Renderer
 * - Toda comunicação passa por handlers IPC tipados no Main Process
 *
 * O objeto `window.electronAPI` fica disponível no Renderer com tipagem
 * definida em shared/types/index.ts (interface ElectronAPI).
 */

import { contextBridge, ipcRenderer } from 'electron'
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
  CreateTicketPayload,
  CreateWorkflowPayload,
  CreateUserPayload,
  DeleteEntityAttachmentPayload,
  DeleteEntityExpensePayload,
  DeleteExpenseAttachmentPayload,
  DeleteProjectTaskAppointmentPayload,
  DeleteProjectTaskPayload,
  ExpenseEntityType,
  GetAttachmentDownloadUrlPayload,
  LoginResult,
  Project,
  ProjectTask,
  ResetPasswordPayload,
  SlaRule,
  Ticket,
  TransitionTicketStepPayload,
  ToggleUserActivePayload,
  UpdateEntityExpensePayload,
  UpdateProjectPayload,
  UpdateProjectTaskAppointmentPayload,
  UpdateProjectTaskPayload,
  UpdateDiscordRulePayload,
  UpdateSlaRulePayload,
  UpdateWorkflowPayload,
  UpdateUserPayload,
  UploadEntityAttachmentPayload,
  UploadExpenseAttachmentPayload,
  User,
  Workflow,
} from '../shared/types'

// ─── API exposta ao Renderer ──────────────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Autenticação ────────────────────────────────────────────────────────────
  login: (email: string, password: string): Promise<LoginResult> =>
    ipcRenderer.invoke('auth:login', email, password),

  logout: (): Promise<void> =>
    ipcRenderer.invoke('auth:logout'),

  getSession: (): Promise<LoginResult | null> =>
    ipcRenderer.invoke('auth:get-session'),

  // ── Gestão de usuários (admin) ──────────────────────────────────────────────
  listUsers: (): Promise<User[]> =>
    ipcRenderer.invoke('auth:list-users'),

  createUser: (payload: CreateUserPayload): Promise<User> =>
    ipcRenderer.invoke('auth:create-user', payload),

  updateUser: (payload: UpdateUserPayload): Promise<User> =>
    ipcRenderer.invoke('auth:update-user', payload),

  resetPassword: (payload: ResetPasswordPayload): Promise<void> =>
    ipcRenderer.invoke('auth:reset-password', payload),

  toggleUserActive: (payload: ToggleUserActivePayload): Promise<User> =>
    ipcRenderer.invoke('auth:toggle-user-active', payload),

  // ── Tickets ────────────────────────────────────────────────────────────────
  listTickets: (): Promise<Ticket[]> =>
    ipcRenderer.invoke('ticket:list'),

  getTicketById: (ticketId: string): Promise<Ticket> =>
    ipcRenderer.invoke('ticket:get-by-id', ticketId),

  createTicket: (payload: CreateTicketPayload): Promise<Ticket> =>
    ipcRenderer.invoke('ticket:create', payload),

  transitionTicketStep: (payload: TransitionTicketStepPayload): Promise<Ticket> =>
    ipcRenderer.invoke('ticket:transition-step', payload),

  // ── Despesas e anexos (tickets + projetos) ─────────────────────────────────
  createEntityExpense: (payload: CreateEntityExpensePayload): Promise<Ticket | Project> =>
    payload.entityType === 'ticket'
      ? ipcRenderer.invoke('ticket:create-expense', {
          ticketId: payload.entityId,
          description: payload.description,
          supplier: payload.supplier,
          quantity: payload.quantity,
          unitValue: payload.unitValue,
        })
      : ipcRenderer.invoke('project:create-expense', {
          projectId: payload.entityId,
          description: payload.description,
          supplier: payload.supplier,
          quantity: payload.quantity,
          unitValue: payload.unitValue,
        }),

  updateEntityExpense: (payload: UpdateEntityExpensePayload): Promise<Ticket | Project> =>
    payload.entityType === 'ticket'
      ? ipcRenderer.invoke('ticket:update-expense', {
          ticketId: payload.entityId,
          expenseId: payload.expenseId,
          description: payload.description,
          supplier: payload.supplier,
          quantity: payload.quantity,
          unitValue: payload.unitValue,
        })
      : ipcRenderer.invoke('project:update-expense', {
          projectId: payload.entityId,
          expenseId: payload.expenseId,
          description: payload.description,
          supplier: payload.supplier,
          quantity: payload.quantity,
          unitValue: payload.unitValue,
        }),

  deleteEntityExpense: (payload: DeleteEntityExpensePayload): Promise<Ticket | Project> =>
    payload.entityType === 'ticket'
      ? ipcRenderer.invoke('ticket:delete-expense', {
          ticketId: payload.entityId,
          expenseId: payload.expenseId,
        })
      : ipcRenderer.invoke('project:delete-expense', {
          projectId: payload.entityId,
          expenseId: payload.expenseId,
        }),

  uploadExpenseAttachment: (payload: UploadExpenseAttachmentPayload): Promise<Ticket | Project> =>
    payload.entityType === 'ticket'
      ? ipcRenderer.invoke('ticket:upload-expense-attachment', {
          ticketId: payload.entityId,
          expenseId: payload.expenseId,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64Content: payload.base64Content,
        })
      : ipcRenderer.invoke('project:upload-expense-attachment', {
          projectId: payload.entityId,
          expenseId: payload.expenseId,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64Content: payload.base64Content,
        }),

  deleteExpenseAttachment: (payload: DeleteExpenseAttachmentPayload): Promise<Ticket | Project> =>
    payload.entityType === 'ticket'
      ? ipcRenderer.invoke('ticket:delete-expense-attachment', {
          ticketId: payload.entityId,
          expenseId: payload.expenseId,
          attachmentId: payload.attachmentId,
        })
      : ipcRenderer.invoke('project:delete-expense-attachment', {
          projectId: payload.entityId,
          expenseId: payload.expenseId,
          attachmentId: payload.attachmentId,
        }),

  listEntityAttachments: (entityType: ExpenseEntityType, entityId: string): Promise<AttachmentFile[]> =>
    entityType === 'ticket'
      ? ipcRenderer.invoke('ticket:list-attachments', entityId)
      : ipcRenderer.invoke('project:list-attachments', entityId),

  uploadEntityAttachment: (payload: UploadEntityAttachmentPayload): Promise<Ticket | Project> =>
    payload.entityType === 'ticket'
      ? ipcRenderer.invoke('ticket:upload-attachment', {
          ticketId: payload.entityId,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64Content: payload.base64Content,
        })
      : ipcRenderer.invoke('project:upload-attachment', {
          projectId: payload.entityId,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64Content: payload.base64Content,
        }),

  deleteEntityAttachment: (payload: DeleteEntityAttachmentPayload): Promise<Ticket | Project> =>
    payload.entityType === 'ticket'
      ? ipcRenderer.invoke('ticket:delete-attachment', {
          ticketId: payload.entityId,
          attachmentId: payload.attachmentId,
        })
      : ipcRenderer.invoke('project:delete-attachment', {
          projectId: payload.entityId,
          attachmentId: payload.attachmentId,
        }),

  getAttachmentDownloadUrl: (payload: GetAttachmentDownloadUrlPayload): Promise<string> =>
    ipcRenderer.invoke('attachment:get-download-url', payload),

  // ── SLA ────────────────────────────────────────────────────────────────────
  listSlaRules: (): Promise<SlaRule[]> =>
    ipcRenderer.invoke('sla:list'),

  createSlaRule: (payload: CreateSlaRulePayload): Promise<SlaRule> =>
    ipcRenderer.invoke('sla:create', payload),

  updateSlaRule: (payload: UpdateSlaRulePayload): Promise<SlaRule> =>
    ipcRenderer.invoke('sla:update', payload),

  deleteSlaRule: (ruleId: string): Promise<void> =>
    ipcRenderer.invoke('sla:delete', ruleId),

  // ── Workflows ──────────────────────────────────────────────────────────────
  listWorkflows: (): Promise<Workflow[]> =>
    ipcRenderer.invoke('workflow:list'),

  createWorkflow: (payload: CreateWorkflowPayload): Promise<Workflow> =>
    ipcRenderer.invoke('workflow:create', payload),

  updateWorkflow: (payload: UpdateWorkflowPayload): Promise<Workflow> =>
    ipcRenderer.invoke('workflow:update', payload),

  deleteWorkflow: (workflowId: string): Promise<void> =>
    ipcRenderer.invoke('workflow:delete', workflowId),

  setDefaultWorkflow: (workflowId: string): Promise<Workflow> =>
    ipcRenderer.invoke('workflow:set-default', workflowId),

  // ── Discord ────────────────────────────────────────────────────────────────
  listDiscordRules: () =>
    ipcRenderer.invoke('discord:list-rules'),

  createDiscordRule: (payload: CreateDiscordRulePayload) =>
    ipcRenderer.invoke('discord:create-rule', payload),

  updateDiscordRule: (payload: UpdateDiscordRulePayload) =>
    ipcRenderer.invoke('discord:update-rule', payload),

  deleteDiscordRule: (ruleId: string) =>
    ipcRenderer.invoke('discord:delete-rule', ruleId),

  // ── Projetos ───────────────────────────────────────────────────────────────
  listProjects: (): Promise<Project[]> =>
    ipcRenderer.invoke('project:list'),

  getProjectById: (projectId: string): Promise<Project> =>
    ipcRenderer.invoke('project:get-by-id', projectId),

  createProject: (payload: CreateProjectPayload): Promise<Project> =>
    ipcRenderer.invoke('project:create', payload),

  updateProject: (payload: UpdateProjectPayload): Promise<Project> =>
    ipcRenderer.invoke('project:update', payload),

  deleteProject: (projectId: string): Promise<void> =>
    ipcRenderer.invoke('project:delete', projectId),

  createProjectTask: (payload: CreateProjectTaskPayload): Promise<Project> =>
    ipcRenderer.invoke('project:create-task', payload),

  updateProjectTask: (payload: UpdateProjectTaskPayload): Promise<Project> =>
    ipcRenderer.invoke('project:update-task', payload),

  deleteProjectTask: (payload: DeleteProjectTaskPayload): Promise<Project> =>
    ipcRenderer.invoke('project:delete-task', payload),

  createProjectTaskAppointment: (
    payload: CreateProjectTaskAppointmentPayload,
  ): Promise<ProjectTask> =>
    ipcRenderer.invoke('project:create-task-appointment', payload),

  updateProjectTaskAppointment: (
    payload: UpdateProjectTaskAppointmentPayload,
  ): Promise<ProjectTask> =>
    ipcRenderer.invoke('project:update-task-appointment', payload),

  deleteProjectTaskAppointment: (
    payload: DeleteProjectTaskAppointmentPayload,
  ): Promise<ProjectTask> =>
    ipcRenderer.invoke('project:delete-task-appointment', payload),

  // ── Cronômetros ─────────────────────────────────────────────────────────────
  startTimer: (
    entityId: string,
    entityType: 'ticket' | 'project_task',
    entityTitle: string,
  ): Promise<ActiveTimer> =>
    ipcRenderer.invoke('timer:start', entityId, entityType, entityTitle),

  pauseTimer: (timerId: string): Promise<ActiveTimer> =>
    ipcRenderer.invoke('timer:pause', timerId),

  stopTimer: (timerId: string): Promise<Appointment> =>
    ipcRenderer.invoke('timer:stop', timerId),

  getActiveTimers: (): Promise<ActiveTimer[]> =>
    ipcRenderer.invoke('timer:get-active'),

  // ── Janela flutuante ────────────────────────────────────────────────────────
  openFloatingWindow: (): Promise<void> =>
    ipcRenderer.invoke('floating-window:open'),

  closeFloatingWindow: (): Promise<void> =>
    ipcRenderer.invoke('floating-window:close'),

  toggleFloatingPin: (pinned: boolean): Promise<boolean> =>
    ipcRenderer.invoke('floating-window:toggle-pin', pinned),

  // ── Eventos (Main → Renderer) ───────────────────────────────────────────────
  onTimerTick: (callback: (timers: ActiveTimer[]) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, timers: ActiveTimer[]): void => {
      callback(timers)
    }
    ipcRenderer.on('timer:tick', listener)
    return () => {
      ipcRenderer.removeListener('timer:tick', listener)
    }
  },
} satisfies import('../shared/types').ElectronAPI)
