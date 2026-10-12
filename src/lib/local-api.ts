import { addDays, differenceInMinutes } from 'date-fns'
import { z } from 'zod'
import type {
  ActiveTimer,
  AddTicketCommentPayload,
  ApiIntegration,
  AppConfig,
  Appointment,
  ApproveCompletionPayload,
  ApproveTicketPayload,
  AttachmentFile,
  AuditLog,
  CostCenter,
  CreateApiIntegrationPayload,
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
  DeleteEntityAttachmentPayload,
  DeleteEntityExpensePayload,
  DeleteExpenseAttachmentPayload,
  DeleteProjectTaskAppointmentPayload,
  DeleteProjectTaskPayload,
  DeleteTicketAppointmentPayload,
  DiscordNotificationRule,
  GestecAPI,
  Expense,
  ExpenseEntityType,
  GetAttachmentDownloadUrlPayload,
  ListTicketsFilterPayload,
  SessionResult,
  Project,
  ProjectTask,
  SlaRule,
  SubmitTicketEvaluationPayload,
  Ticket,
  TicketPriority,
  TicketReportStats,
  ToggleUserActivePayload,
  TransitionTicketStepPayload,
  TriageTicketPayload,
  UpdateApiIntegrationPayload,
  UpdateCostCenterPayload,
  UpdateDiscordRulePayload,
  UpdateEntityExpensePayload,
  UpdateProjectPayload,
  UpdateProjectTaskAppointmentPayload,
  UpdateProjectTaskPayload,
  UpdateServiceTicketPayload,
  UpdateSlaRulePayload,
  UpdateTicketPayload,
  UpdateTicketTaskPayload,
  UpdateUserPayload,
  UpdateWorkflowPayload,
  UploadEntityAttachmentPayload,
  UploadExpenseAttachmentPayload,
  User,
  Workflow,
} from '../../shared/types'
import { filterTicketsByScope, filterTicketsForWorkQueue } from '../../shared/lib/ticket-access'
import {
  getNextPublicTicketId,
  isPublicTicketId,
} from '../../shared/lib/ticket-public-id'
import { calcDeadline, getSlaStatus } from '../../shared/lib/sla'
import { getInitialStepForType, WORKFLOW_STEPS } from '../../shared/lib/workflow-steps'

const KEYS = {
  users: 'gestec.users',
  tickets: 'gestec.tickets',
  projects: 'gestec.projects',
  workflows: 'gestec.workflows',
  slaRules: 'gestec.slaRules',
  discordRules: 'gestec.discordRules',
  auditLogs: 'gestec.auditLogs',
  costCenters: 'gestec.costCenters',
  appConfig: 'gestec.appConfig',
  apiIntegrations: 'gestec.apiIntegrations',
  session: 'gestec.session',
  timers: 'gestec.timers',
} as const

const DEMO_SEED_KEY = 'gestec.demoSeeded'
const DEMO_SEED_VERSION = 'v2'

type StorageKey = (typeof KEYS)[keyof typeof KEYS]

type StoredUser = User

interface LocalSession {
  userId: string
  expiresAt: string
}

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['member', 'manager', 'admin']),
})
const ticketSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  requesterName: z.string().min(1),
  costCenter: z.string().min(1),
  type: z.enum(['incident', 'service_interruption', 'improvement', 'request', 'cancellation']),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']),
  serviceGroup: z.string().min(1),
})
const projectSchema = z.object({
  name: z.string().min(1),
  costCenter: z.string().min(1),
  hourlyRate: z.number().positive(),
})

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function read<T>(key: StorageKey, fallback: T): T {
  const raw = localStorage.getItem(key)
  if (!raw) return clone(fallback)
  try {
    return JSON.parse(raw) as T
  } catch {
    return clone(fallback)
  }
}

function write<T>(key: StorageKey, value: T): T {
  localStorage.setItem(key, JSON.stringify(value))
  return value
}

function id(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function now(): string {
  return new Date().toISOString()
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function currentTime(): string {
  return new Date().toTimeString().slice(0, 5)
}

function fail(code: string, message = code): never {
  throw Object.assign(new Error(message), { code })
}

function publicUser(user: StoredUser): User {
  return user
}

function currentSession(): LocalSession | null {
  const session = read<LocalSession | null>(KEYS.session, null)
  if (!session) return null
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    localStorage.removeItem(KEYS.session)
    return null
  }
  return session
}

function ensureSession(): LocalSession {
  const existing = currentSession()
  if (existing) return existing

  const users = read<StoredUser[]>(KEYS.users, [])
  const user = users.find((item) => item.active && item.role === 'admin') ?? users.find((item) => item.active)
  if (!user) fail('UNAUTHORIZED')

  const session = { userId: user.id, expiresAt: addDays(new Date(), 365).toISOString() }
  write<LocalSession>(KEYS.session, session)
  return session
}

function requireUser(): StoredUser {
  const session = ensureSession()
  const user = read<StoredUser[]>(KEYS.users, []).find((item) => item.id === session.userId)
  if (!user || !user.active) fail('UNAUTHORIZED')
  return user
}

function saveUsers(users: StoredUser[]): StoredUser[] {
  return write(KEYS.users, users)
}

function saveTickets(tickets: Ticket[]): Ticket[] {
  return write(KEYS.tickets, tickets)
}

function normalizeTicketPublicIds(tickets: Ticket[]): Ticket[] {
  let changed = false
  const normalized: Ticket[] = []
  for (const ticket of tickets) {
    const alreadyUsed = normalized.some((item) => item.ticketNumber === ticket.ticketNumber)
    if (isPublicTicketId(ticket.ticketNumber) && !alreadyUsed) {
      normalized.push(ticket)
      continue
    }
    changed = true
    normalized.push({
      ...ticket,
      ticketNumber: getNextPublicTicketId(normalized),
    })
  }
  if (changed) saveTickets(normalized)
  return normalized
}

function saveProjects(projects: Project[]): Project[] {
  return write(KEYS.projects, projects)
}

function defaultWorkflow(): Workflow {
  const createdAt = now()
  const stepIds = [
    WORKFLOW_STEPS.in_triage,
    WORKFLOW_STEPS.awaiting_it_manager_approval,
    WORKFLOW_STEPS.awaiting_app_manager_approval,
    WORKFLOW_STEPS.awaiting_cancellation_approval,
    WORKFLOW_STEPS.awaiting_service,
    WORKFLOW_STEPS.in_service,
    WORKFLOW_STEPS.awaiting_completion_approval,
    WORKFLOW_STEPS.awaiting_evaluation,
    WORKFLOW_STEPS.completed,
    WORKFLOW_STEPS.cancelled,
  ]

  return {
    id: 'local-default-workflow',
    name: 'Workflow Zeev padrão',
    description: 'Fluxo local padrão para triagem, atendimento, aprovações e conclusão.',
    isDefault: true,
    steps: stepIds.map((stepId, index) => ({
      id: stepId,
      name: stepId
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      type: stepId.includes('approval') ? 'approval' : 'manual',
      order: index + 1,
    })),
    transitions: [],
    createdAt,
    updatedAt: createdAt,
  }
}

function normalizeWorkflowPayload(
  payload: CreateWorkflowPayload,
  fallback?: Workflow,
): Pick<Workflow, 'name' | 'description' | 'isDefault' | 'steps' | 'transitions'> {
  const steps = payload.steps.map((step) => ({
    ...step,
    id: step.id ?? id(),
  }))
  const transitions = payload.transitions.map((transition) => ({
    ...transition,
    id: transition.id ?? id(),
  }))

  return {
    name: payload.name,
    description: payload.description,
    isDefault: payload.isDefault ?? fallback?.isDefault ?? false,
    steps,
    transitions,
  }
}

function demoDate(daysOffset: number, hour = 9, minute = 0): string {
  const date = addDays(new Date(), daysOffset)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

function demoAppointment(
  technicianId: string,
  daysOffset: number,
  startTime: string,
  endTime: string,
  totalMinutes: number,
  note: string,
): Appointment {
  return {
    id: id(),
    date: demoDate(daysOffset).slice(0, 10),
    startTime,
    endTime,
    totalMinutes,
    technicianId,
    origin: 'manual',
    note,
  }
}

function demoTicket(params: {
  number: number
  title: string
  description: string
  requesterName: string
  requesterEmail: string
  requesterUserId?: string
  costCenter: string
  type: Ticket['type']
  priority: TicketPriority
  serviceGroup: Ticket['serviceGroup']
  status: string
  workflowId: string
  createdAt: string
  updatedAt?: string
  triageAssigneeId?: string
  assigneeId?: string
  additionalAssigneeId?: string
  appManagerId?: string
  cancellationApproverId?: string
  cancellationItems?: Ticket['cancellationItems']
  comments?: Ticket['comments']
  tasks?: Ticket['tasks']
  appointments?: Appointment[]
  workflowHistory?: Ticket['workflowHistory']
  evaluation?: Ticket['evaluation']
}): Ticket {
  const deadline = addDays(new Date(params.createdAt), params.priority === 'P1' ? 1 : params.priority === 'P2' ? 2 : 4).toISOString()
  return {
    id: `demo-ticket-${params.number}`,
    ticketNumber: `#${params.number}`,
    openedAt: params.createdAt,
    source: 'manual',
    title: params.title,
    description: params.description,
    requester: {
      name: params.requesterName,
      email: params.requesterEmail,
      costCenter: params.costCenter,
    },
    requesterUserId: params.requesterUserId,
    type: params.type,
    priority: params.priority,
    serviceGroup: params.serviceGroup,
    status: params.status,
    workflowId: params.workflowId,
    triageAssigneeId: params.triageAssigneeId,
    assigneeId: params.assigneeId,
    additionalAssigneeId: params.additionalAssigneeId,
    appManagerId: params.appManagerId,
    cancellationApproverId: params.cancellationApproverId,
    cancellationItems: params.cancellationItems,
    tasks: params.tasks ?? [],
    comments: params.comments ?? [],
    appointments: params.appointments ?? [],
    expenses: [],
    attachments: [],
    workflowHistory: params.workflowHistory ?? [],
    sla: {
      deadline,
      firstContactAt: params.appointments?.[0] ? params.createdAt : undefined,
      resolvedAt: params.status === WORKFLOW_STEPS.completed ? params.updatedAt ?? params.createdAt : undefined,
      status: getSlaStatus(new Date().toISOString(), deadline),
    },
    evaluation: params.evaluation,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt ?? params.createdAt,
  }
}

function seedIfNeeded(): void {
  if (localStorage.getItem(KEYS.users)) return

  const createdAt = now()
  const workflow = defaultWorkflow()
  const admin: StoredUser = {
    id: 'local-admin',
    name: 'Administrador Local',
    email: 'admin',
    role: 'admin',
    active: true,
    permissions: ['admin'],
    createdAt,
    updatedAt: createdAt,
  }
  const joao: StoredUser = {
    id: 'demo-joao',
    name: 'Joao Lopes',
    email: 'joao.lopes@tecnoplanta.com.br',
    role: 'manager',
    active: true,
    permissions: ['triage'],
    createdAt,
    updatedAt: createdAt,
  }
  const marina: StoredUser = {
    id: 'demo-marina',
    name: 'Marina Costa',
    email: 'marina.costa@tecnoplanta.com.br',
    role: 'member',
    active: true,
    permissions: [],
    createdAt,
    updatedAt: createdAt,
  }
  const bruno: StoredUser = {
    id: 'demo-bruno',
    name: 'Bruno Almeida',
    email: 'bruno.almeida@tecnoplanta.com.br',
    role: 'member',
    active: true,
    permissions: [],
    createdAt,
    updatedAt: createdAt,
  }
  const users = [admin, joao, marina, bruno]
  const tickets: Ticket[] = [
    demoTicket({
      number: 1,
      title: 'VPN desconectando no setor de vendas',
      description: 'Usuario perde a conexao VPN varias vezes ao dia durante acesso ao SIGER.',
      requesterName: 'Marina Costa',
      requesterEmail: marina.email,
      requesterUserId: marina.id,
      costCenter: 'COM',
      type: 'incident',
      priority: 'P2',
      serviceGroup: 'network_internet',
      status: WORKFLOW_STEPS.in_triage,
      workflowId: workflow.id,
      triageAssigneeId: admin.id,
      createdAt: demoDate(-1, 8, 35),
      updatedAt: demoDate(0, 9, 10),
      comments: [
        { id: id(), authorId: joao.id, body: 'Validar impacto com vendas antes de encaminhar.', isInternal: true, createdAt: demoDate(-1, 10, 15) },
      ],
    }),
    demoTicket({
      number: 2,
      title: 'Cadastro de novo colaborador no e-mail',
      description: 'Criar conta corporativa e liberar grupos padrao para o novo assistente administrativo.',
      requesterName: 'Bruno Almeida',
      requesterEmail: bruno.email,
      requesterUserId: bruno.id,
      costCenter: 'ADM',
      type: 'request',
      priority: 'P3',
      serviceGroup: 'emails',
      status: WORKFLOW_STEPS.awaiting_service,
      workflowId: workflow.id,
      assigneeId: admin.id,
      createdAt: demoDate(-2, 14, 20),
      updatedAt: demoDate(0, 8, 45),
      tasks: [
        { id: id(), description: 'Criar caixa postal e aplicar assinatura padrao', assigneeId: admin.id, dueDate: demoDate(1).slice(0, 10), status: 'pending', createdAt: demoDate(-1, 9), updatedAt: demoDate(-1, 9) },
      ],
    }),
    demoTicket({
      number: 3,
      title: 'Impressora da expedicao sem toner',
      description: 'Equipamento imprime com falhas e precisa de verificacao de suprimentos.',
      requesterName: 'Carla Mendes',
      requesterEmail: 'carla.mendes@tecnoplanta.com.br',
      costCenter: 'OPS',
      type: 'incident',
      priority: 'P4',
      serviceGroup: 'printers',
      status: WORKFLOW_STEPS.in_service,
      workflowId: workflow.id,
      assigneeId: admin.id,
      createdAt: demoDate(-3, 11, 5),
      updatedAt: demoDate(0, 10, 5),
      appointments: [demoAppointment(admin.id, -1, '13:00', '13:40', 40, 'Teste de impressao e limpeza inicial realizados.')],
    }),
    demoTicket({
      number: 4,
      title: 'Melhoria no painel de indicadores comerciais',
      description: 'Adicionar comparativo mensal por vendedor no painel de metas.',
      requesterName: 'Joao Lopes',
      requesterEmail: joao.email,
      requesterUserId: joao.id,
      costCenter: 'COM',
      type: 'improvement',
      priority: 'P3',
      serviceGroup: 'dashboards',
      status: WORKFLOW_STEPS.awaiting_app_manager_approval,
      workflowId: workflow.id,
      appManagerId: joao.id,
      createdAt: demoDate(-4, 16, 15),
      updatedAt: demoDate(-1, 17, 0),
    }),
    demoTicket({
      number: 5,
      title: 'Cancelar solicitacao duplicada de compra',
      description: 'Pedido foi aberto duas vezes na plataforma de processos.',
      requesterName: 'Marina Costa',
      requesterEmail: marina.email,
      requesterUserId: marina.id,
      costCenter: 'ADM',
      type: 'cancellation',
      priority: 'P3',
      serviceGroup: 'process_platform',
      status: WORKFLOW_STEPS.awaiting_cancellation_approval,
      workflowId: workflow.id,
      cancellationApproverId: admin.id,
      cancellationItems: [{ id: id(), requestNumber: 'ZV-18472', justification: 'Registro duplicado', status: 'pending' }],
      createdAt: demoDate(-2, 15, 10),
      updatedAt: demoDate(-1, 9, 30),
    }),
    demoTicket({
      number: 6,
      title: 'Troca de notebook concluida',
      description: 'Equipamento antigo substituido por notebook revisado do estoque.',
      requesterName: 'Pedro Henrique',
      requesterEmail: 'pedro.henrique@tecnoplanta.com.br',
      costCenter: 'OPS',
      type: 'request',
      priority: 'P3',
      serviceGroup: 'gestec',
      status: WORKFLOW_STEPS.completed,
      workflowId: workflow.id,
      assigneeId: admin.id,
      createdAt: demoDate(-8, 9, 20),
      updatedAt: demoDate(-5, 16, 40),
      appointments: [demoAppointment(admin.id, -6, '09:30', '10:45', 75, 'Configuracao, entrega e validacao com usuario.')],
      evaluation: { metExpectation: true, score: 9, feedback: 'Atendimento rapido e equipamento funcionando bem.' },
    }),
    demoTicket({
      number: 7,
      title: 'Erro ao emitir nota no SIGER',
      description: 'Sistema retorna mensagem de rejeicao ao confirmar NF-e.',
      requesterName: 'Bruno Almeida',
      requesterEmail: bruno.email,
      requesterUserId: bruno.id,
      costCenter: 'ADM',
      type: 'service_interruption',
      priority: 'P1',
      serviceGroup: 'erp',
      status: WORKFLOW_STEPS.in_service,
      workflowId: workflow.id,
      assigneeId: joao.id,
      additionalAssigneeId: admin.id,
      createdAt: demoDate(0, 7, 50),
      updatedAt: demoDate(0, 11, 20),
      comments: [
        { id: id(), authorId: admin.id, body: 'Chamado acompanhado com prioridade por impacto fiscal.', isInternal: true, createdAt: demoDate(0, 8, 30) },
      ],
    }),
    demoTicket({
      number: 8,
      title: 'Solicitar acesso ao servidor de arquivos',
      description: 'Liberar permissao de leitura para pasta do projeto industrial.',
      requesterName: 'Administrador Local',
      requesterEmail: admin.email,
      requesterUserId: admin.id,
      costCenter: 'TI',
      type: 'request',
      priority: 'P4',
      serviceGroup: 'access_accounts',
      status: WORKFLOW_STEPS.awaiting_evaluation,
      workflowId: workflow.id,
      assigneeId: joao.id,
      createdAt: demoDate(-6, 10, 0),
      updatedAt: demoDate(-2, 14, 0),
    }),
  ]
  const projects: Project[] = [
    {
      id: 'demo-project-1',
      name: 'Modernizacao do parque de notebooks',
      description: 'Levantamento e substituicao gradual dos equipamentos mais antigos.',
      costCenter: 'TI',
      hourlyRate: 145,
      tasks: [
        { id: 'demo-project-task-1', title: 'Inventario dos equipamentos', description: 'Conferir ativos por setor.', assigneeId: admin.id, appointments: [demoAppointment(admin.id, -2, '08:00', '09:30', 90, 'Planilha inicial atualizada.')], expenses: [], createdAt: demoDate(-10), updatedAt: demoDate(-2) },
        { id: 'demo-project-task-2', title: 'Planejar trocas da expedicao', description: 'Priorizar usuarios com maior tempo de uso.', assigneeId: joao.id, appointments: [], expenses: [], createdAt: demoDate(-7), updatedAt: demoDate(-1) },
      ],
      expenses: [],
      attachments: [],
      createdAt: demoDate(-12),
      updatedAt: demoDate(-1),
    },
  ]

  write(KEYS.users, users)
  write(KEYS.tickets, tickets)
  write(KEYS.projects, projects)
  write(KEYS.workflows, [workflow])
  write<SlaRule[]>(KEYS.slaRules, [
    { id: id(), name: 'P1 - Critico', priority: 'P1', deadlineHours: 4, createdAt, updatedAt: createdAt },
    { id: id(), name: 'P2 - Alto', priority: 'P2', deadlineHours: 8, createdAt, updatedAt: createdAt },
    { id: id(), name: 'P3 - Normal', priority: 'P3', deadlineHours: 24, createdAt, updatedAt: createdAt },
    { id: id(), name: 'P4 - Baixo', priority: 'P4', deadlineHours: 72, createdAt, updatedAt: createdAt },
  ])
  write<DiscordNotificationRule[]>(KEYS.discordRules, [
    {
      id: 'demo-discord-rule-1',
      name: 'Avisar chamados P1',
      webhookUrl: 'https://discord.com/api/webhooks/demo/simulado',
      triggerOn: 'ticket_created',
      conditions: [{ field: 'priority', operator: 'equal', value: 'P1' }],
      messageTemplate: 'Novo ticket critico {ticket.publicId} - {ticket.priority}',
      active: true,
      createdAt,
      updatedAt: createdAt,
    },
  ])
  write<AuditLog[]>(KEYS.auditLogs, tickets.slice(0, 5).map((ticket) => ({
    id: id(),
    entityType: 'ticket',
    entityId: ticket.id,
    action: 'demo_seed_created',
    userId: 'system',
    workflowStep: ticket.status,
    justification: 'Registro ficticio criado para demonstracao local.',
    createdAt: ticket.createdAt,
  })))
  write<CostCenter[]>(KEYS.costCenters, [
    { id: id(), code: 'TI', name: 'Tecnologia da Informacao', active: true, createdAt, updatedAt: createdAt },
    { id: id(), code: 'ADM', name: 'Administrativo', active: true, createdAt, updatedAt: createdAt },
    { id: id(), code: 'OPS', name: 'Operacoes', active: true, createdAt, updatedAt: createdAt },
    { id: id(), code: 'COM', name: 'Comercial', active: true, createdAt, updatedAt: createdAt },
  ])
  write<AppConfig>(KEYS.appConfig, {
    id: 'default',
    npsLowScoreThreshold: 6,
    adjustmentTimeoutDays: 3,
    adjustmentTimeoutEnabled: true,
    defaultTriageAssigneeId: admin.id,
    defaultCancellationApproverId: admin.id,
    emailEnabled: false,
    updatedAt: createdAt,
  })
  write<ApiIntegration[]>(KEYS.apiIntegrations, [
    {
      id: 'demo-api-integration-1',
      name: 'Consulta de ativos - simulado',
      kind: 'rest_json',
      method: 'GET',
      url: 'https://api.exemplo.local/ativos',
      authType: 'none',
      parameters: [{ key: 'patrimonio', value: '{assetCode}' }],
      headers: [],
      accessoryFields: [],
      locked: true,
      createdById: admin.id,
      createdByName: admin.name,
      createdAt,
      updatedAt: createdAt,
    },
  ])
  write<ActiveTimer[]>(KEYS.timers, [
    {
      id: 'demo-timer-1',
      entityId: 'demo-ticket-7',
      entityType: 'ticket',
      entityTitle: 'Erro ao emitir nota no SIGER',
      state: 'running',
      startedAt: demoDate(0, 11, 30),
      accumulatedSeconds: 14 * 60,
      technicianId: admin.id,
    },
  ])
  localStorage.removeItem(KEYS.session)
  localStorage.setItem(DEMO_SEED_KEY, DEMO_SEED_VERSION)
}

function seedDemoDataIfEmpty(): void {
  if (localStorage.getItem(DEMO_SEED_KEY) === DEMO_SEED_VERSION) return

  const createdAt = now()
  const users = read<StoredUser[]>(KEYS.users, [])
  const admin = users.find((user) => user.role === 'admin') ?? users[0]
  if (!admin) return

  const joao: StoredUser =
    users.find((user) => user.id === 'demo-joao') ?? {
      id: 'demo-joao',
      name: 'Joao Lopes',
      email: 'joao.lopes@tecnoplanta.com.br',
      role: 'manager',
      active: true,
      permissions: ['triage'],
      createdAt,
      updatedAt: createdAt,
    }
  const marina: StoredUser =
    users.find((user) => user.id === 'demo-marina') ?? {
      id: 'demo-marina',
      name: 'Marina Costa',
      email: 'marina.costa@tecnoplanta.com.br',
      role: 'member',
      active: true,
      permissions: [],
      createdAt,
      updatedAt: createdAt,
    }

  const workflow = read<Workflow[]>(KEYS.workflows, [defaultWorkflow()])[0] ?? defaultWorkflow()
  const costCenters = read<CostCenter[]>(KEYS.costCenters, [])
  const existingTickets = read<Ticket[]>(KEYS.tickets, [])
  const tickets: Ticket[] = [
    demoTicket({
      number: 101,
      title: 'VPN desconectando no setor de vendas',
      description: 'Usuario perde a conexao VPN varias vezes ao dia durante acesso ao SIGER.',
      requesterName: marina.name,
      requesterEmail: marina.email,
      requesterUserId: marina.id,
      costCenter: 'COM',
      type: 'incident',
      priority: 'P2',
      serviceGroup: 'network_internet',
      status: WORKFLOW_STEPS.in_triage,
      workflowId: workflow.id,
      triageAssigneeId: admin.id,
      createdAt: demoDate(-1, 8, 35),
      updatedAt: demoDate(0, 9, 10),
    }),
    demoTicket({
      number: 102,
      title: 'Cadastro de novo colaborador no e-mail',
      description: 'Criar conta corporativa e liberar grupos padrao para o novo assistente administrativo.',
      requesterName: 'Bruno Almeida',
      requesterEmail: 'bruno.almeida@tecnoplanta.com.br',
      costCenter: 'ADM',
      type: 'request',
      priority: 'P3',
      serviceGroup: 'emails',
      status: WORKFLOW_STEPS.awaiting_service,
      workflowId: workflow.id,
      assigneeId: admin.id,
      createdAt: demoDate(-2, 14, 20),
      updatedAt: demoDate(0, 8, 45),
    }),
    demoTicket({
      number: 103,
      title: 'Erro ao emitir nota no SIGER',
      description: 'Sistema retorna mensagem de rejeicao ao confirmar NF-e.',
      requesterName: joao.name,
      requesterEmail: joao.email,
      requesterUserId: joao.id,
      costCenter: 'ADM',
      type: 'service_interruption',
      priority: 'P1',
      serviceGroup: 'erp',
      status: WORKFLOW_STEPS.in_service,
      workflowId: workflow.id,
      assigneeId: joao.id,
      additionalAssigneeId: admin.id,
      createdAt: demoDate(0, 7, 50),
      updatedAt: demoDate(0, 11, 20),
    }),
  ]

  saveUsers([...users, ...[joao, marina].filter((user) => !users.some((item) => item.id === user.id))])
  write(KEYS.tickets, [
    ...existingTickets,
    ...tickets.filter((ticket) => !existingTickets.some((item) => item.id === ticket.id)),
  ])
  if (!read<Workflow[]>(KEYS.workflows, []).length) write(KEYS.workflows, [workflow])
  write(KEYS.costCenters, costCenters.some((item) => item.code === 'COM') ? costCenters : [...costCenters, { id: id(), code: 'COM', name: 'Comercial', active: true, createdAt, updatedAt: createdAt }])
  const existingIntegrations = read<ApiIntegration[]>(KEYS.apiIntegrations, [])
  if (!existingIntegrations.some((item) => item.id === 'demo-api-integration-1')) {
    write<ApiIntegration[]>(KEYS.apiIntegrations, [
      ...existingIntegrations,
      {
        id: 'demo-api-integration-1',
        name: 'Consulta de ativos - simulado',
        kind: 'rest_json',
        method: 'GET',
        url: 'https://api.exemplo.local/ativos',
        authType: 'none',
        parameters: [{ key: 'patrimonio', value: '{assetCode}' }],
        headers: [],
        accessoryFields: [],
        locked: true,
        createdById: admin.id,
        createdByName: admin.name,
        createdAt,
        updatedAt: createdAt,
      },
    ])
  }
  write<ActiveTimer[]>(KEYS.timers, [
    {
      id: 'demo-timer-1',
      entityId: 'demo-ticket-103',
      entityType: 'ticket',
      entityTitle: 'Erro ao emitir nota no SIGER',
      state: 'running',
      startedAt: demoDate(0, 11, 30),
      accumulatedSeconds: 14 * 60,
      technicianId: admin.id,
    },
  ])
  const existingAuditLogs = read<AuditLog[]>(KEYS.auditLogs, [])
  write(KEYS.auditLogs, [
    ...tickets
      .filter((ticket) => !existingAuditLogs.some((item) => item.entityId === ticket.id && item.action === 'demo_seed_created'))
      .map((ticket) => ({
    id: id(),
    entityType: 'ticket',
    entityId: ticket.id,
    action: 'demo_seed_created',
    userId: 'system',
    workflowStep: ticket.status,
    justification: 'Registro ficticio criado para demonstracao local.',
    createdAt: ticket.createdAt,
      })),
    ...existingAuditLogs,
  ])
  localStorage.setItem(DEMO_SEED_KEY, DEMO_SEED_VERSION)
}

function addAudit(
  entityType: AuditLog['entityType'],
  entityId: string,
  action: string,
  extra: Partial<AuditLog> = {},
): void {
  const user = currentSession()
  const entry: AuditLog = {
    id: id(),
    entityType,
    entityId,
    action,
    userId: user?.userId ?? 'system',
    createdAt: now(),
    ...extra,
  }
  write(KEYS.auditLogs, [entry, ...read<AuditLog[]>(KEYS.auditLogs, [])])
}

function defaultWorkflowId(): string {
  const workflows = read<Workflow[]>(KEYS.workflows, [])
  return workflows.find((workflow) => workflow.isDefault)?.id ?? workflows[0]?.id ?? defaultWorkflow().id
}

function deadlineFor(ticketCreatedAt: string, priority: TicketPriority, serviceGroup: string): string {
  const rules = read<SlaRule[]>(KEYS.slaRules, [])
  const rule =
    rules.find((item) => item.priority === priority && item.serviceGroup === serviceGroup) ??
    rules.find((item) => item.priority === priority && !item.serviceGroup) ??
    rules.find((item) => !item.priority && item.serviceGroup === serviceGroup)
  const hours = rule?.deadlineHours ?? ({ P1: 4, P2: 8, P3: 24, P4: 72 }[priority] ?? 24)
  return calcDeadline(ticketCreatedAt, hours)
}

function refreshTicketSla(ticket: Ticket): Ticket {
  if (ticket.sla.resolvedAt || !ticket.sla.deadline) return ticket
  return {
    ...ticket,
    sla: {
      ...ticket.sla,
      status: getSlaStatus(ticket.createdAt, ticket.sla.deadline),
    },
  }
}

function updateTicketRecord(ticketId: string, updater: (ticket: Ticket) => Ticket): Ticket {
  const tickets = read<Ticket[]>(KEYS.tickets, [])
  const index = tickets.findIndex((ticket) => ticket.id === ticketId)
  if (index < 0) fail('TICKET_NOT_FOUND')
  const next = refreshTicketSla({ ...updater(tickets[index]), updatedAt: now() })
  tickets[index] = next
  saveTickets(tickets)
  return clone(next)
}

function setTicketStatus(ticket: Ticket, status: string, userId?: string): Ticket {
  const changedAt = now()
  return {
    ...ticket,
    status,
    workflowHistory: [
      ...(ticket.workflowHistory ?? []),
      {
        id: id(),
        fromStepId: ticket.status,
        toStepId: status,
        changedBy: userId ?? currentSession()?.userId ?? 'system',
        changedAt,
      },
    ],
  }
}

function upsertExpense(expenses: Expense[], payload: CreateEntityExpensePayload): Expense[] {
  const createdAt = now()
  return [
    ...expenses,
    {
      id: id(),
      description: payload.description,
      supplier: payload.supplier,
      quantity: payload.quantity,
      unitValue: payload.unitValue,
      totalValue: payload.quantity * payload.unitValue,
      receiptFiles: [],
      createdAt,
      updatedAt: createdAt,
    },
  ]
}

function updateExpense(expenses: Expense[], payload: UpdateEntityExpensePayload): Expense[] {
  return expenses.map((expense) => {
    if (expense.id !== payload.expenseId) return expense
    const quantity = payload.quantity ?? expense.quantity
    const unitValue = payload.unitValue ?? expense.unitValue
    return {
      ...expense,
      description: payload.description ?? expense.description,
      supplier: payload.supplier ?? expense.supplier,
      quantity,
      unitValue,
      totalValue: quantity * unitValue,
      updatedAt: now(),
    }
  })
}

function attachmentDisabled(): never {
  fail('BLOB_DISABLED', 'Anexos estao desabilitados no modo local.')
}

function findProjectTask(projects: Project[], taskId: string): { project: Project; task: ProjectTask } | null {
  for (const project of projects) {
    const task = project.tasks.find((item) => item.id === taskId)
    if (task) return { project, task }
  }
  return null
}

function timerSeconds(timer: ActiveTimer): number {
  if (timer.state !== 'running') return timer.accumulatedSeconds
  return timer.accumulatedSeconds + Math.max(0, Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 1000))
}

function appointmentFromTimer(timer: ActiveTimer): Appointment {
  const totalMinutes = Math.max(1, Math.ceil(timerSeconds(timer) / 60))
  return {
    id: id(),
    date: today(),
    startTime: new Date(timer.startedAt).toTimeString().slice(0, 5),
    endTime: currentTime(),
    totalMinutes,
    technicianId: timer.technicianId,
    origin: 'timer',
    note: `Apontamento gerado pelo cronometro local (${timer.entityTitle}).`,
  }
}

seedIfNeeded()
seedDemoDataIfEmpty()

export const localAPI: GestecAPI = {
  async getSession(): Promise<SessionResult | null> {
    const session = ensureSession()
    const user = read<StoredUser[]>(KEYS.users, []).find((item) => item.id === session.userId)
    return user ? { user: publicUser(user), expiresAt: session.expiresAt } : null
  },

  async logout(): Promise<void> {
    localStorage.removeItem(KEYS.session)
  },

  async listUsers(): Promise<User[]> {
    requireUser()
    return read<StoredUser[]>(KEYS.users, []).map(publicUser)
  },

  async createUser(payload: CreateUserPayload): Promise<User> {
    requireUser()
    const parsed = userSchema.safeParse(payload)
    if (!parsed.success) fail('INVALID_INPUT')
    const users = read<StoredUser[]>(KEYS.users, [])
    if (users.some((item) => item.email.toLowerCase() === parsed.data.email.toLowerCase())) {
      fail('EMAIL_ALREADY_EXISTS')
    }
    const createdAt = now()
    const user: StoredUser = {
      id: id(),
      name: parsed.data.name.trim(),
      email: parsed.data.email.trim().toLowerCase(),
      role: parsed.data.role,
      active: true,
      permissions: parsed.data.role === 'admin' ? ['admin'] : [],
      createdAt,
      updatedAt: createdAt,
    }
    saveUsers([...users, user])
    addAudit('user', user.id, 'create')
    return publicUser(user)
  },

  async updateUser(payload: UpdateUserPayload): Promise<User> {
    requireUser()
    const users = read<StoredUser[]>(KEYS.users, [])
    const index = users.findIndex((item) => item.id === payload.id)
    if (index < 0) fail('USER_NOT_FOUND')
    if (payload.email && users.some((item) => item.email === payload.email && item.id !== payload.id)) {
      fail('EMAIL_ALREADY_EXISTS')
    }
    users[index] = {
      ...users[index],
      ...payload,
      email: payload.email?.trim().toLowerCase() ?? users[index].email,
      updatedAt: now(),
    }
    saveUsers(users)
    addAudit('user', users[index].id, 'update')
    return publicUser(users[index])
  },

  async toggleUserActive(payload: ToggleUserActivePayload): Promise<User> {
    const current = requireUser()
    if (current.id === payload.userId && !payload.active) fail('SELF_DEACTIVATE_FORBIDDEN')
    const users = read<StoredUser[]>(KEYS.users, [])
    const index = users.findIndex((item) => item.id === payload.userId)
    if (index < 0) fail('USER_NOT_FOUND')
    users[index] = { ...users[index], active: payload.active, updatedAt: now() }
    saveUsers(users)
    addAudit('user', payload.userId, payload.active ? 'activate' : 'deactivate')
    return publicUser(users[index])
  },

  async listTickets(filter?: ListTicketsFilterPayload): Promise<Ticket[]> {
    const user = requireUser()
    const tickets = normalizeTicketPublicIds(read<Ticket[]>(KEYS.tickets, [])).map(refreshTicketSla)
    const queued = tickets.filter((ticket) => {
      if (!filter?.queue || filter.queue === 'all') return true
      if (filter.queue === 'mine') return filterTicketsForWorkQueue([ticket], user).length > 0
      if (filter.queue === 'triage') return ticket.status === WORKFLOW_STEPS.in_triage
      if (filter.queue === 'service') return [WORKFLOW_STEPS.awaiting_service, WORKFLOW_STEPS.in_service].includes(ticket.status as never)
      if (filter.queue === 'completion') return ticket.status === WORKFLOW_STEPS.awaiting_completion_approval
      if (filter.queue === 'approvals_it') return ticket.status === WORKFLOW_STEPS.awaiting_it_manager_approval
      if (filter.queue === 'approvals_app') return ticket.status === WORKFLOW_STEPS.awaiting_app_manager_approval
      if (filter.queue === 'cancellation') return ticket.status === WORKFLOW_STEPS.awaiting_cancellation_approval
      return true
    })
    const filtered =
      filter?.queue === 'all' && filter.scope
        ? filterTicketsByScope(queued, filter.scope, user)
        : queued
    return clone(filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
  },

  async getTicketById(ticketId: string): Promise<Ticket> {
    requireUser()
    const ticket = normalizeTicketPublicIds(read<Ticket[]>(KEYS.tickets, [])).find((item) => item.id === ticketId)
    if (!ticket) fail('TICKET_NOT_FOUND')
    return clone(refreshTicketSla(ticket))
  },

  async createTicket(payload: CreateTicketPayload): Promise<Ticket> {
    const user = requireUser()
    const parsed = ticketSchema.safeParse(payload)
    if (!parsed.success) fail('INVALID_INPUT')
    const tickets = read<Ticket[]>(KEYS.tickets, [])
    const createdAt = now()
    const status = getInitialStepForType(payload.type, payload.directCancellation)
    const deadline = deadlineFor(createdAt, payload.priority, payload.serviceGroup)
    const appConfig = read<AppConfig>(KEYS.appConfig, {} as AppConfig)
    const ticket: Ticket = {
      id: id(),
      ticketNumber: getNextPublicTicketId(tickets),
      openedAt: createdAt,
      source: 'manual',
      title: payload.title.trim(),
      description: payload.description.trim(),
      requester: {
        name: payload.requesterName.trim(),
        email: payload.requesterEmail?.trim().toLowerCase() ?? `${user.id}@gestec.local`,
        costCenter: payload.costCenter,
      },
      requesterUserId: payload.requesterUserId,
      type: payload.type,
      priority: payload.priority,
      serviceGroup: payload.serviceGroup,
      service: payload.service,
      unavailableSystem: payload.unavailableSystem,
      inoperableInfrastructure: payload.inoperableInfrastructure,
      applicationProcess: payload.applicationProcess,
      improvementAcknowledged: payload.improvementAcknowledged,
      appManagerId: payload.appManagerId,
      cancellationItems: payload.cancellationItems?.map((item) => ({
        id: id(),
        requestNumber: item.requestNumber,
        justification: item.justification,
        status: 'pending',
      })),
      cancellationApproverId: payload.cancellationApproverId,
      directCancellation: payload.directCancellation,
      status,
      workflowId: defaultWorkflowId(),
      triageAssigneeId: status === WORKFLOW_STEPS.in_triage ? appConfig.defaultTriageAssigneeId : undefined,
      level: payload.level,
      assetCode: payload.assetCode,
      supportNotes: payload.supportNotes,
      downtimeMinutes: payload.downtimeMinutes,
      tasks: [],
      comments: [],
      appointments: [],
      expenses: [],
      attachments: [],
      workflowHistory: [],
      sla: { deadline, status: getSlaStatus(createdAt, deadline) },
      createdAt,
      updatedAt: createdAt,
    }
    saveTickets([...tickets, ticket])
    addAudit('ticket', ticket.id, 'create', { workflowStep: ticket.status })
    return clone(ticket)
  },

  async updateTicket(payload: UpdateTicketPayload): Promise<Ticket> {
    requireUser()
    return updateTicketRecord(payload.ticketId, (ticket) => ({
      ...ticket,
      ...payload,
      id: ticket.id,
      sla: payload.priority
        ? {
            ...ticket.sla,
            deadline: deadlineFor(ticket.createdAt, payload.priority, ticket.serviceGroup),
          }
        : ticket.sla,
    }))
  },

  async approveTicket(payload: ApproveTicketPayload): Promise<Ticket> {
    const user = requireUser()
    return updateTicketRecord(payload.ticketId, (ticket) => {
      if (!payload.approved && !payload.justification?.trim()) fail('JUSTIFICATION_REQUIRED')
      const decision = {
        approved: payload.approved,
        justification: payload.justification,
        decidedBy: user.id,
        decidedAt: now(),
      }
      if (payload.stage === 'it_manager') {
        const next = payload.approved
          ? ticket.appManagerId
            ? WORKFLOW_STEPS.awaiting_app_manager_approval
            : WORKFLOW_STEPS.in_triage
          : WORKFLOW_STEPS.improvement_rejected_by_it
        addAudit('ticket', ticket.id, 'email_simulated', { justification: 'Notificacao por e-mail simulada no modo local.' })
        return setTicketStatus({ ...ticket, itManagerDecision: decision }, next, user.id)
      }
      if (payload.stage === 'app_manager') {
        const next = payload.approved ? WORKFLOW_STEPS.in_triage : WORKFLOW_STEPS.improvement_rejected_by_app
        addAudit('ticket', ticket.id, 'discord_simulated', { justification: 'Webhook Discord simulado no modo local.' })
        return setTicketStatus({ ...ticket, appManagerDecision: decision }, next, user.id)
      }
      const items = ticket.cancellationItems?.map((item) => ({
        ...item,
        status: payload.approved ? ('approved' as const) : ('rejected' as const),
        processedAt: now(),
      }))
      return setTicketStatus(
        { ...ticket, cancellationDecision: decision, cancellationItems: items, isCancelled: payload.approved },
        payload.approved ? WORKFLOW_STEPS.cancellation_completed : WORKFLOW_STEPS.cancellation_rejected,
        user.id,
      )
    })
  },

  async triageTicket(payload: TriageTicketPayload): Promise<Ticket> {
    const user = requireUser()
    return updateTicketRecord(payload.ticketId, (ticket) => {
      if (payload.decision === 'reject' && !payload.justification?.trim()) fail('JUSTIFICATION_REQUIRED')
      const base = {
        ...ticket,
        assigneeId: payload.assigneeId ?? ticket.assigneeId,
        requester: { ...ticket.requester, costCenter: payload.costCenter ?? ticket.requester.costCenter },
        type: payload.type ?? ticket.type,
        priority: payload.priority ?? ticket.priority,
        level: payload.level ?? ticket.level,
        serviceGroup: payload.serviceGroup ?? ticket.serviceGroup,
      }
      if (payload.decision === 'approve') return setTicketStatus(base, WORKFLOW_STEPS.awaiting_service, user.id)
      if (payload.decision === 'adjustment') {
        return setTicketStatus(
          {
            ...base,
            adjustmentRequestedAt: now(),
            adjustmentDeadline: addDays(new Date(), read<AppConfig>(KEYS.appConfig, {} as AppConfig).adjustmentTimeoutDays ?? 3).toISOString(),
          },
          WORKFLOW_STEPS.awaiting_requester_adjustment,
          user.id,
        )
      }
      return setTicketStatus(base, WORKFLOW_STEPS.triage_rejected, user.id)
    })
  },

  async startTicketService(ticketId: string): Promise<Ticket> {
    const user = requireUser()
    return updateTicketRecord(ticketId, (ticket) =>
      setTicketStatus(
        {
          ...ticket,
          assigneeId: ticket.assigneeId ?? user.id,
          sla: { ...ticket.sla, firstContactAt: ticket.sla.firstContactAt ?? now() },
        },
        WORKFLOW_STEPS.in_service,
        user.id,
      ),
    )
  },

  async skipTicketInitialContact(ticketId: string): Promise<Ticket> {
    requireUser()
    return updateTicketRecord(ticketId, (ticket) => ({ ...ticket, initialContactSkipped: true }))
  },

  async completeTicketService(payload: { ticketId: string; resolutionSummary?: string; deliveredEquipment?: Ticket['deliveredEquipment'] }): Promise<Ticket> {
    const user = requireUser()
    if (!payload.resolutionSummary?.trim()) fail('RESOLUTION_REQUIRED')
    return updateTicketRecord(payload.ticketId, (ticket) =>
      setTicketStatus(
        {
          ...ticket,
          supportNotes: payload.resolutionSummary,
          deliveredEquipment: payload.deliveredEquipment ?? ticket.deliveredEquipment,
        },
        WORKFLOW_STEPS.awaiting_completion_approval,
        user.id,
      ),
    )
  },

  async updateServiceTicket(payload: UpdateServiceTicketPayload): Promise<Ticket> {
    requireUser()
    return updateTicketRecord(payload.ticketId, (ticket) => ({
      ...ticket,
      costCenter: payload.costCenter,
      requester: { ...ticket.requester, costCenter: payload.costCenter ?? ticket.requester.costCenter },
      priority: payload.priority ?? ticket.priority,
      level: payload.level ?? ticket.level,
      serviceGroup: payload.serviceGroup ?? ticket.serviceGroup,
      serviceDueDate: payload.serviceDueDate ?? ticket.serviceDueDate,
      additionalAssigneeId: payload.additionalAssigneeId === null ? undefined : payload.additionalAssigneeId ?? ticket.additionalAssigneeId,
      supportNotes: payload.supportNotes ?? ticket.supportNotes,
      deliveredEquipment: payload.deliveredEquipment ?? ticket.deliveredEquipment,
      createPlatformUser: payload.createPlatformUser ?? ticket.createPlatformUser,
      createEmail: payload.createEmail ?? ticket.createEmail,
      facilitatorChecklist: payload.facilitatorChecklist ?? ticket.facilitatorChecklist,
      securitySealChanged: payload.securitySealChanged ?? ticket.securitySealChanged,
      securitySealCode: payload.securitySealCode ?? ticket.securitySealCode,
      newSecuritySealCode: payload.newSecuritySealCode ?? ticket.newSecuritySealCode,
    }))
  },

  async approveTicketCompletion(payload: ApproveCompletionPayload): Promise<Ticket> {
    const user = requireUser()
    return updateTicketRecord(payload.ticketId, (ticket) => {
      if (!payload.approved && !payload.justification?.trim()) fail('JUSTIFICATION_REQUIRED')
      const next = payload.approved ? WORKFLOW_STEPS.awaiting_evaluation : WORKFLOW_STEPS.in_service
      return setTicketStatus(
        {
          ...ticket,
          sla: payload.approved
            ? {
                ...ticket.sla,
                resolvedAt: now(),
                status: ticket.sla.deadline
                  ? getSlaStatus(ticket.createdAt, ticket.sla.deadline)
                  : 'ok',
              }
            : ticket.sla,
        },
        next,
        user.id,
      )
    })
  },

  async submitTicketEvaluation(payload: SubmitTicketEvaluationPayload): Promise<Ticket> {
    const user = requireUser()
    return updateTicketRecord(payload.ticketId, (ticket) =>
      setTicketStatus(
        {
          ...ticket,
          evaluation: {
            metExpectation: payload.metExpectation,
            score: payload.score,
            expectation: payload.expectation,
            feedback: payload.feedback,
            npsJustification: payload.npsJustification,
          },
        },
        WORKFLOW_STEPS.completed,
        user.id,
      ),
    )
  },

  async createTicketTask(payload: CreateTicketTaskPayload): Promise<Ticket> {
    return updateTicketRecord(payload.ticketId, (ticket) => ({
      ...ticket,
      tasks: [
        ...(ticket.tasks ?? []),
        {
          id: id(),
          description: payload.description,
          assigneeId: payload.assigneeId,
          dueDate: payload.dueDate,
          status: 'pending',
          createdAt: now(),
          updatedAt: now(),
        },
      ],
    }))
  },

  async updateTicketTask(payload: UpdateTicketTaskPayload): Promise<Ticket> {
    return updateTicketRecord(payload.ticketId, (ticket) => ({
      ...ticket,
      tasks: (ticket.tasks ?? []).map((task) =>
        task.id === payload.taskId
          ? {
              ...task,
              description: payload.description ?? task.description,
              assigneeId: payload.assigneeId === null ? undefined : payload.assigneeId ?? task.assigneeId,
              dueDate: payload.dueDate ?? task.dueDate,
              status: payload.status ?? task.status,
              updatedAt: now(),
            }
          : task,
      ),
    }))
  },

  async createTicketAppointment(payload: CreateTicketAppointmentPayload): Promise<Ticket> {
    return updateTicketRecord(payload.ticketId, (ticket) => {
      const totalMinutes = Math.max(1, differenceInMinutes(new Date(`${payload.date}T${payload.endTime}`), new Date(`${payload.date}T${payload.startTime}`)))
      return {
        ...ticket,
        appointments: [
          ...(ticket.appointments ?? []),
          {
            id: id(),
            date: payload.date,
            startTime: payload.startTime,
            endTime: payload.endTime,
            totalMinutes,
            technicianId: payload.technicianId ?? requireUser().id,
            origin: 'manual',
            note: payload.note,
          },
        ],
      }
    })
  },

  async deleteTicketAppointment(payload: DeleteTicketAppointmentPayload): Promise<Ticket> {
    return updateTicketRecord(payload.ticketId, (ticket) => ({
      ...ticket,
      appointments: ticket.appointments.filter((appointment) => appointment.id !== payload.appointmentId),
    }))
  },

  async addTicketComment(payload: AddTicketCommentPayload): Promise<Ticket> {
    const user = requireUser()
    if (!payload.body.trim()) fail('COMMENT_REQUIRED')
    return updateTicketRecord(payload.ticketId, (ticket) => ({
      ...ticket,
      comments: [
        ...(ticket.comments ?? []),
        { id: id(), authorId: user.id, body: payload.body.trim(), isInternal: Boolean(payload.isInternal), createdAt: now() },
      ],
    }))
  },

  async listAuditLogs(entityId: string): Promise<AuditLog[]> {
    requireUser()
    return read<AuditLog[]>(KEYS.auditLogs, []).filter((item) => item.entityId === entityId)
  },

  async listCostCenters(): Promise<CostCenter[]> {
    requireUser()
    return read<CostCenter[]>(KEYS.costCenters, [])
  },

  async createCostCenter(payload: CreateCostCenterPayload): Promise<CostCenter> {
    requireUser()
    const createdAt = now()
    const costCenter: CostCenter = { id: id(), code: payload.code, name: payload.name, active: true, createdAt, updatedAt: createdAt }
    write(KEYS.costCenters, [...read<CostCenter[]>(KEYS.costCenters, []), costCenter])
    return costCenter
  },

  async updateCostCenter(payload: UpdateCostCenterPayload): Promise<CostCenter> {
    requireUser()
    const items = read<CostCenter[]>(KEYS.costCenters, [])
    const index = items.findIndex((item) => item.id === payload.id)
    if (index < 0) fail('COST_CENTER_NOT_FOUND')
    items[index] = { ...items[index], ...payload, updatedAt: now() }
    write(KEYS.costCenters, items)
    return items[index]
  },

  async getAppConfig(): Promise<AppConfig> {
    requireUser()
    return read<AppConfig>(KEYS.appConfig, {} as AppConfig)
  },

  async updateAppConfig(payload: Partial<Omit<AppConfig, 'id'>>): Promise<AppConfig> {
    requireUser()
    const config = { ...read<AppConfig>(KEYS.appConfig, {} as AppConfig), ...payload, id: 'default' as const, updatedAt: now() }
    write(KEYS.appConfig, config)
    return config
  },

  async getTicketReportStats(): Promise<TicketReportStats> {
    requireUser()
    const tickets = read<Ticket[]>(KEYS.tickets, [])
    const byType: Record<string, number> = {}
    const byPriority: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    let scoreTotal = 0
    let evaluationCount = 0
    for (const ticket of tickets) {
      byType[ticket.type] = (byType[ticket.type] ?? 0) + 1
      byPriority[ticket.priority] = (byPriority[ticket.priority] ?? 0) + 1
      byStatus[ticket.status] = (byStatus[ticket.status] ?? 0) + 1
      if (ticket.evaluation) {
        scoreTotal += ticket.evaluation.score
        evaluationCount += 1
      }
    }
    return {
      totalOpen: tickets.filter((ticket) => ![WORKFLOW_STEPS.completed, WORKFLOW_STEPS.cancelled].includes(ticket.status as never)).length,
      byType,
      byPriority,
      byStatus,
      averageScore: evaluationCount ? scoreTotal / evaluationCount : null,
      evaluationCount,
    }
  },

  async createEntityExpense(payload: CreateEntityExpensePayload): Promise<Ticket | Project> {
    requireUser()
    if (payload.entityType === 'ticket') {
      return updateTicketRecord(payload.entityId, (ticket) => ({ ...ticket, expenses: upsertExpense(ticket.expenses ?? [], payload) }))
    }
    const projects = read<Project[]>(KEYS.projects, [])
    const index = projects.findIndex((project) => project.id === payload.entityId)
    if (index < 0) fail('PROJECT_NOT_FOUND')
    projects[index] = { ...projects[index], expenses: upsertExpense(projects[index].expenses ?? [], payload), updatedAt: now() }
    saveProjects(projects)
    return clone(projects[index])
  },

  async updateEntityExpense(payload: UpdateEntityExpensePayload): Promise<Ticket | Project> {
    requireUser()
    if (payload.entityType === 'ticket') {
      return updateTicketRecord(payload.entityId, (ticket) => ({ ...ticket, expenses: updateExpense(ticket.expenses ?? [], payload) }))
    }
    const projects = read<Project[]>(KEYS.projects, [])
    const index = projects.findIndex((project) => project.id === payload.entityId)
    if (index < 0) fail('PROJECT_NOT_FOUND')
    projects[index] = { ...projects[index], expenses: updateExpense(projects[index].expenses ?? [], payload), updatedAt: now() }
    saveProjects(projects)
    return clone(projects[index])
  },

  async deleteEntityExpense(payload: DeleteEntityExpensePayload): Promise<Ticket | Project> {
    requireUser()
    if (payload.entityType === 'ticket') {
      return updateTicketRecord(payload.entityId, (ticket) => ({
        ...ticket,
        expenses: (ticket.expenses ?? []).filter((expense) => expense.id !== payload.expenseId),
      }))
    }
    const projects = read<Project[]>(KEYS.projects, [])
    const index = projects.findIndex((project) => project.id === payload.entityId)
    if (index < 0) fail('PROJECT_NOT_FOUND')
    projects[index] = {
      ...projects[index],
      expenses: (projects[index].expenses ?? []).filter((expense) => expense.id !== payload.expenseId),
      updatedAt: now(),
    }
    saveProjects(projects)
    return clone(projects[index])
  },

  async uploadExpenseAttachment(_payload: UploadExpenseAttachmentPayload): Promise<Ticket | Project> {
    attachmentDisabled()
  },
  async deleteExpenseAttachment(_payload: DeleteExpenseAttachmentPayload): Promise<Ticket | Project> {
    attachmentDisabled()
  },
  async listEntityAttachments(entityType: ExpenseEntityType, entityId: string): Promise<AttachmentFile[]> {
    requireUser()
    if (entityType === 'ticket') return (await this.getTicketById(entityId)).attachments
    return (await this.getProjectById(entityId)).attachments
  },
  async uploadEntityAttachment(_payload: UploadEntityAttachmentPayload): Promise<Ticket | Project> {
    attachmentDisabled()
  },
  async deleteEntityAttachment(_payload: DeleteEntityAttachmentPayload): Promise<Ticket | Project> {
    attachmentDisabled()
  },
  async getAttachmentDownloadUrl(_payload: GetAttachmentDownloadUrlPayload): Promise<string> {
    attachmentDisabled()
  },

  async listSlaRules(): Promise<SlaRule[]> {
    requireUser()
    return read<SlaRule[]>(KEYS.slaRules, [])
  },
  async createSlaRule(payload: CreateSlaRulePayload): Promise<SlaRule> {
    requireUser()
    const createdAt = now()
    const rule: SlaRule = { id: id(), ...payload, createdAt, updatedAt: createdAt }
    write(KEYS.slaRules, [...read<SlaRule[]>(KEYS.slaRules, []), rule])
    return rule
  },
  async updateSlaRule(payload: UpdateSlaRulePayload): Promise<SlaRule> {
    requireUser()
    const rules = read<SlaRule[]>(KEYS.slaRules, [])
    const index = rules.findIndex((rule) => rule.id === payload.id)
    if (index < 0) fail('SLA_RULE_NOT_FOUND')
    rules[index] = {
      ...rules[index],
      ...payload,
      priority: payload.priority === null ? undefined : payload.priority ?? rules[index].priority,
      serviceGroup: payload.serviceGroup === null ? undefined : payload.serviceGroup ?? rules[index].serviceGroup,
      updatedAt: now(),
    }
    write(KEYS.slaRules, rules)
    return rules[index]
  },
  async deleteSlaRule(ruleId: string): Promise<void> {
    requireUser()
    write(KEYS.slaRules, read<SlaRule[]>(KEYS.slaRules, []).filter((rule) => rule.id !== ruleId))
  },

  async listWorkflows(): Promise<Workflow[]> {
    requireUser()
    return read<Workflow[]>(KEYS.workflows, [])
  },
  async createWorkflow(payload: CreateWorkflowPayload): Promise<Workflow> {
    requireUser()
    const createdAt = now()
    const workflow: Workflow = {
      id: id(),
      ...normalizeWorkflowPayload(payload),
      isDefault: Boolean(payload.isDefault),
      createdAt,
      updatedAt: createdAt,
    }
    const workflows = read<Workflow[]>(KEYS.workflows, [])
    write(KEYS.workflows, payload.isDefault ? workflows.map((item) => ({ ...item, isDefault: false })).concat(workflow) : [...workflows, workflow])
    return workflow
  },
  async updateWorkflow(payload: UpdateWorkflowPayload): Promise<Workflow> {
    requireUser()
    const workflows = read<Workflow[]>(KEYS.workflows, [])
    const index = workflows.findIndex((workflow) => workflow.id === payload.id)
    if (index < 0) fail('WORKFLOW_NOT_FOUND')
    workflows[index] = {
      ...workflows[index],
      name: payload.name ?? workflows[index].name,
      description: payload.description ?? workflows[index].description,
      isDefault: payload.isDefault ?? workflows[index].isDefault,
      steps: payload.steps?.map((step) => ({ ...step, id: step.id ?? id() })) ?? workflows[index].steps,
      transitions:
        payload.transitions?.map((transition) => ({ ...transition, id: transition.id ?? id() })) ??
        workflows[index].transitions,
      updatedAt: now(),
    }
    if (payload.isDefault) {
      for (const workflow of workflows) workflow.isDefault = workflow.id === payload.id
    }
    write(KEYS.workflows, workflows)
    return workflows[index]
  },
  async deleteWorkflow(workflowId: string): Promise<void> {
    requireUser()
    const workflows = read<Workflow[]>(KEYS.workflows, [])
    if (workflows.length <= 1) fail('WORKFLOW_LAST_DELETE_FORBIDDEN')
    const removed = workflows.find((workflow) => workflow.id === workflowId)
    if (!removed) fail('WORKFLOW_NOT_FOUND')
    const next = workflows.filter((workflow) => workflow.id !== workflowId)
    if (removed.isDefault && next[0]) next[0].isDefault = true
    write(KEYS.workflows, next)
  },
  async setDefaultWorkflow(workflowId: string): Promise<Workflow> {
    requireUser()
    const workflows = read<Workflow[]>(KEYS.workflows, [])
    const target = workflows.find((workflow) => workflow.id === workflowId)
    if (!target) fail('WORKFLOW_NOT_FOUND')
    for (const workflow of workflows) workflow.isDefault = workflow.id === workflowId
    write(KEYS.workflows, workflows)
    return target
  },
  async transitionTicketStep(payload: TransitionTicketStepPayload): Promise<Ticket> {
    const user = requireUser()
    return updateTicketRecord(payload.ticketId, (ticket) => setTicketStatus(ticket, payload.toStepId, user.id))
  },

  async listDiscordRules(): Promise<DiscordNotificationRule[]> {
    requireUser()
    return read<DiscordNotificationRule[]>(KEYS.discordRules, [])
  },
  async createDiscordRule(payload: CreateDiscordRulePayload): Promise<DiscordNotificationRule> {
    requireUser()
    const createdAt = now()
    const rule: DiscordNotificationRule = { id: id(), ...payload, createdAt, updatedAt: createdAt }
    write(KEYS.discordRules, [...read<DiscordNotificationRule[]>(KEYS.discordRules, []), rule])
    addAudit('ticket', 'system', 'discord_rule_created_simulated', { justification: 'Webhooks Discord ficam cadastrados, mas envio e simulado no modo local.' })
    return rule
  },
  async updateDiscordRule(payload: UpdateDiscordRulePayload): Promise<DiscordNotificationRule> {
    requireUser()
    const rules = read<DiscordNotificationRule[]>(KEYS.discordRules, [])
    const index = rules.findIndex((rule) => rule.id === payload.id)
    if (index < 0) fail('DISCORD_RULE_NOT_FOUND')
    rules[index] = { ...rules[index], ...payload, updatedAt: now() }
    write(KEYS.discordRules, rules)
    return rules[index]
  },
  async deleteDiscordRule(ruleId: string): Promise<void> {
    requireUser()
    write(KEYS.discordRules, read<DiscordNotificationRule[]>(KEYS.discordRules, []).filter((rule) => rule.id !== ruleId))
  },

  async listApiIntegrations(): Promise<ApiIntegration[]> {
    requireUser()
    return read<ApiIntegration[]>(KEYS.apiIntegrations, [])
  },
  async getApiIntegrationById(integrationId: string): Promise<ApiIntegration> {
    requireUser()
    const integration = read<ApiIntegration[]>(KEYS.apiIntegrations, []).find((item) => item.id === integrationId)
    if (!integration) fail('API_INTEGRATION_NOT_FOUND')
    return integration
  },
  async createApiIntegration(payload: CreateApiIntegrationPayload): Promise<ApiIntegration> {
    const user = requireUser()
    const createdAt = now()
    const integration: ApiIntegration = {
      id: id(),
      name: payload.name,
      kind: payload.kind ?? 'rest_json',
      method: payload.method,
      url: payload.url,
      body: payload.body,
      authType: payload.authType ?? 'none',
      authToken: payload.authToken,
      parameters: payload.parameters ?? [],
      headers: payload.headers ?? [],
      transformFilter: payload.transformFilter,
      transformValue: payload.transformValue,
      transformText: payload.transformText,
      transformSort: payload.transformSort,
      transformErrorMessage: payload.transformErrorMessage,
      transformFriendlyMessage: payload.transformFriendlyMessage,
      accessoryFields: payload.accessoryFields ?? [],
      locked: payload.locked,
      createdById: user.id,
      createdByName: user.name,
      createdAt,
      updatedAt: createdAt,
    }
    write(KEYS.apiIntegrations, [...read<ApiIntegration[]>(KEYS.apiIntegrations, []), integration])
    return integration
  },
  async updateApiIntegration(payload: UpdateApiIntegrationPayload): Promise<ApiIntegration> {
    requireUser()
    const integrations = read<ApiIntegration[]>(KEYS.apiIntegrations, [])
    const index = integrations.findIndex((item) => item.id === payload.id)
    if (index < 0) fail('API_INTEGRATION_NOT_FOUND')
    integrations[index] = { ...integrations[index], ...payload, updatedAt: now() }
    write(KEYS.apiIntegrations, integrations)
    return integrations[index]
  },
  async deleteApiIntegration(integrationId: string): Promise<void> {
    requireUser()
    write(KEYS.apiIntegrations, read<ApiIntegration[]>(KEYS.apiIntegrations, []).filter((item) => item.id !== integrationId))
  },

  async listProjects(): Promise<Project[]> {
    requireUser()
    return read<Project[]>(KEYS.projects, []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
  async getProjectById(projectId: string): Promise<Project> {
    requireUser()
    const project = read<Project[]>(KEYS.projects, []).find((item) => item.id === projectId)
    if (!project) fail('PROJECT_NOT_FOUND')
    return clone(project)
  },
  async createProject(payload: CreateProjectPayload): Promise<Project> {
    requireUser()
    const parsed = projectSchema.safeParse(payload)
    if (!parsed.success) fail('INVALID_INPUT')
    const createdAt = now()
    const project: Project = {
      id: id(),
      name: payload.name,
      description: payload.description,
      costCenter: payload.costCenter,
      hourlyRate: payload.hourlyRate,
      tasks: [],
      expenses: [],
      attachments: [],
      createdAt,
      updatedAt: createdAt,
    }
    saveProjects([...read<Project[]>(KEYS.projects, []), project])
    return project
  },
  async updateProject(payload: UpdateProjectPayload): Promise<Project> {
    requireUser()
    const projects = read<Project[]>(KEYS.projects, [])
    const index = projects.findIndex((project) => project.id === payload.id)
    if (index < 0) fail('PROJECT_NOT_FOUND')
    projects[index] = { ...projects[index], ...payload, updatedAt: now() }
    saveProjects(projects)
    return projects[index]
  },
  async deleteProject(projectId: string): Promise<void> {
    requireUser()
    saveProjects(read<Project[]>(KEYS.projects, []).filter((project) => project.id !== projectId))
  },
  async createProjectTask(payload: CreateProjectTaskPayload): Promise<Project> {
    requireUser()
    const projects = read<Project[]>(KEYS.projects, [])
    const index = projects.findIndex((project) => project.id === payload.projectId)
    if (index < 0) fail('PROJECT_NOT_FOUND')
    const createdAt = now()
    projects[index] = {
      ...projects[index],
      tasks: [
        ...projects[index].tasks,
        { id: id(), title: payload.title, description: payload.description, assigneeId: payload.assigneeId, appointments: [], expenses: [], createdAt, updatedAt: createdAt },
      ],
      updatedAt: createdAt,
    }
    saveProjects(projects)
    return projects[index]
  },
  async updateProjectTask(payload: UpdateProjectTaskPayload): Promise<Project> {
    requireUser()
    const projects = read<Project[]>(KEYS.projects, [])
    const index = projects.findIndex((project) => project.id === payload.projectId)
    if (index < 0) fail('PROJECT_NOT_FOUND')
    projects[index] = {
      ...projects[index],
      tasks: projects[index].tasks.map((task) =>
        task.id === payload.taskId
          ? { ...task, title: payload.title ?? task.title, description: payload.description ?? task.description, assigneeId: payload.assigneeId === null ? undefined : payload.assigneeId ?? task.assigneeId, updatedAt: now() }
          : task,
      ),
      updatedAt: now(),
    }
    saveProjects(projects)
    return projects[index]
  },
  async deleteProjectTask(payload: DeleteProjectTaskPayload): Promise<Project> {
    requireUser()
    const projects = read<Project[]>(KEYS.projects, [])
    const index = projects.findIndex((project) => project.id === payload.projectId)
    if (index < 0) fail('PROJECT_NOT_FOUND')
    projects[index] = { ...projects[index], tasks: projects[index].tasks.filter((task) => task.id !== payload.taskId), updatedAt: now() }
    saveProjects(projects)
    return projects[index]
  },
  async createProjectTaskAppointment(payload: CreateProjectTaskAppointmentPayload): Promise<ProjectTask> {
    requireUser()
    const projects = read<Project[]>(KEYS.projects, [])
    const projectIndex = projects.findIndex((project) => project.id === payload.projectId)
    if (projectIndex < 0) fail('PROJECT_NOT_FOUND')
    const taskIndex = projects[projectIndex].tasks.findIndex((task) => task.id === payload.taskId)
    if (taskIndex < 0) fail('PROJECT_TASK_NOT_FOUND')
    const task = projects[projectIndex].tasks[taskIndex]
    const appointment: Appointment = {
      id: id(),
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime,
      totalMinutes: payload.totalMinutes,
      technicianId: requireUser().id,
      origin: 'manual',
      note: payload.note,
    }
    projects[projectIndex].tasks[taskIndex] = { ...task, appointments: [...task.appointments, appointment], updatedAt: now() }
    projects[projectIndex] = { ...projects[projectIndex], updatedAt: now() }
    saveProjects(projects)
    return projects[projectIndex].tasks[taskIndex]
  },
  async updateProjectTaskAppointment(payload: UpdateProjectTaskAppointmentPayload): Promise<ProjectTask> {
    requireUser()
    const projects = read<Project[]>(KEYS.projects, [])
    const projectIndex = projects.findIndex((project) => project.id === payload.projectId)
    if (projectIndex < 0) fail('PROJECT_NOT_FOUND')
    const taskIndex = projects[projectIndex].tasks.findIndex((task) => task.id === payload.taskId)
    if (taskIndex < 0) fail('PROJECT_TASK_NOT_FOUND')
    projects[projectIndex].tasks[taskIndex] = {
      ...projects[projectIndex].tasks[taskIndex],
      appointments: projects[projectIndex].tasks[taskIndex].appointments.map((appointment) =>
        appointment.id === payload.appointmentId ? { ...appointment, ...payload } : appointment,
      ),
      updatedAt: now(),
    }
    projects[projectIndex] = { ...projects[projectIndex], updatedAt: now() }
    saveProjects(projects)
    return projects[projectIndex].tasks[taskIndex]
  },
  async deleteProjectTaskAppointment(payload: DeleteProjectTaskAppointmentPayload): Promise<ProjectTask> {
    requireUser()
    const projects = read<Project[]>(KEYS.projects, [])
    const projectIndex = projects.findIndex((project) => project.id === payload.projectId)
    if (projectIndex < 0) fail('PROJECT_NOT_FOUND')
    const taskIndex = projects[projectIndex].tasks.findIndex((task) => task.id === payload.taskId)
    if (taskIndex < 0) fail('PROJECT_TASK_NOT_FOUND')
    projects[projectIndex].tasks[taskIndex] = {
      ...projects[projectIndex].tasks[taskIndex],
      appointments: projects[projectIndex].tasks[taskIndex].appointments.filter((appointment) => appointment.id !== payload.appointmentId),
      updatedAt: now(),
    }
    projects[projectIndex] = { ...projects[projectIndex], updatedAt: now() }
    saveProjects(projects)
    return projects[projectIndex].tasks[taskIndex]
  },

  async startTimer(entityId: string, entityType: ActiveTimer['entityType'], entityTitle: string): Promise<ActiveTimer> {
    const user = requireUser()
    const timers = read<ActiveTimer[]>(KEYS.timers, [])
    const existing = timers.find((timer) => timer.entityId === entityId && timer.technicianId === user.id)
    if (existing) return existing
    const timer: ActiveTimer = { id: id(), entityId, entityType, entityTitle, state: 'running', startedAt: now(), accumulatedSeconds: 0, technicianId: user.id }
    write(KEYS.timers, [...timers, timer])
    return timer
  },
  async pauseTimer(timerId: string): Promise<ActiveTimer> {
    requireUser()
    const timers = read<ActiveTimer[]>(KEYS.timers, [])
    const index = timers.findIndex((timer) => timer.id === timerId)
    if (index < 0) fail('TIMER_NOT_FOUND')
    const timer = timers[index]
    timers[index] =
      timer.state === 'running'
        ? { ...timer, state: 'paused', accumulatedSeconds: timerSeconds(timer), startedAt: now() }
        : { ...timer, state: 'running', startedAt: now() }
    write(KEYS.timers, timers)
    return timers[index]
  },
  async stopTimer(timerId: string): Promise<Appointment> {
    requireUser()
    const timers = read<ActiveTimer[]>(KEYS.timers, [])
    const timer = timers.find((item) => item.id === timerId)
    if (!timer) fail('TIMER_NOT_FOUND')
    const appointment = appointmentFromTimer(timer)
    write(KEYS.timers, timers.filter((item) => item.id !== timerId))
    if (timer.entityType === 'ticket') {
      updateTicketRecord(timer.entityId, (ticket) => ({ ...ticket, appointments: [...ticket.appointments, appointment] }))
    } else {
      const projects = read<Project[]>(KEYS.projects, [])
      const found = findProjectTask(projects, timer.entityId)
      if (found) {
        const projectIndex = projects.findIndex((project) => project.id === found.project.id)
        projects[projectIndex] = {
          ...projects[projectIndex],
          tasks: projects[projectIndex].tasks.map((task) =>
            task.id === timer.entityId ? { ...task, appointments: [...task.appointments, appointment], updatedAt: now() } : task,
          ),
          updatedAt: now(),
        }
        saveProjects(projects)
      }
    }
    return appointment
  },
  async getActiveTimers(): Promise<ActiveTimer[]> {
    requireUser()
    return read<ActiveTimer[]>(KEYS.timers, [])
  },
  onTimerTick(callback: (timers: ActiveTimer[]) => void): () => void {
    const intervalId = window.setInterval(() => {
      if (!currentSession()) return
      callback(read<ActiveTimer[]>(KEYS.timers, []))
    }, 1000)
    return () => window.clearInterval(intervalId)
  },
}
