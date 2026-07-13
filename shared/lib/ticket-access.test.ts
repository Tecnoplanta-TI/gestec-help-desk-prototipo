import { describe, expect, it } from 'vitest'
import {
  filterTicketsByScope,
  filterTicketsForWorkQueue,
  isTicketAssignedToUser,
  userCanAccessTicket,
} from './ticket-access'
import { WORKFLOW_STEPS } from './workflow-steps'
import type { Ticket, User } from '../types'

const requester = {
  id: 'requester-1',
  name: 'Solicitante',
  email: 'requester@gestec.local',
  role: 'member',
  active: true,
  permissions: [],
  createdAt: '2026-07-13T10:00:00.000Z',
  updatedAt: '2026-07-13T10:00:00.000Z',
} as User

const technician = {
  id: 'tech-1',
  name: 'Tecnico',
  email: 'tech@gestec.local',
  role: 'member',
  active: true,
  permissions: [],
  createdAt: '2026-07-13T10:00:00.000Z',
  updatedAt: '2026-07-13T10:00:00.000Z',
} as User

const manager = {
  id: 'manager-1',
  name: 'Gestor',
  email: 'manager@gestec.local',
  role: 'manager',
  active: true,
  permissions: [],
  createdAt: '2026-07-13T10:00:00.000Z',
  updatedAt: '2026-07-13T10:00:00.000Z',
} as User

function ticket(overrides: Partial<Ticket>): Ticket {
  return {
    id: overrides.id ?? 'ticket-1',
    ticketNumber: overrides.ticketNumber ?? '#1',
    title: 'Solicitação de teste',
    description: 'Descrição',
    requester: {
      name: 'Solicitante',
      email: requester.email,
      costCenter: 'TI',
    },
    requesterUserId: requester.id,
    type: 'request',
    priority: 'P3',
    serviceGroup: 'network_internet',
    source: 'manual',
    status: WORKFLOW_STEPS.in_triage,
    workflowId: 'workflow-1',
    tasks: [],
    comments: [],
    appointments: [],
    expenses: [],
    attachments: [],
    workflowHistory: [],
    sla: {
      deadline: '2026-07-14T10:00:00.000Z',
      status: 'ok',
    },
    createdAt: '2026-07-13T10:00:00.000Z',
    updatedAt: '2026-07-13T10:00:00.000Z',
    ...overrides,
  } as Ticket
}

describe('ticket-access', () => {
  it('separa solicitações abertas pelo usuário da fila de trabalho atribuída', () => {
    const ownTicket = ticket({ id: 'opened-by-user', requesterUserId: requester.id })
    const assignedTicket = ticket({ id: 'assigned-to-tech', triageAssigneeId: technician.id })

    expect(filterTicketsForWorkQueue([ownTicket, assignedTicket], requester)).toEqual([])
    expect(filterTicketsForWorkQueue([ownTicket, assignedTicket], technician)).toEqual([assignedTicket])
    expect(filterTicketsByScope([ownTicket, assignedTicket], 'mine', requester)).toEqual([ownTicket, assignedTicket])
  })

  it('inclui participantes e usuários com permissão ampla em acompanhar solicitações', () => {
    const participatedTicket = ticket({
      id: 'participated',
      requesterUserId: 'other-requester',
      requester: { name: 'Outro', email: 'other@gestec.local', costCenter: 'TI' },
      comments: [
        {
          id: 'comment-1',
          authorId: technician.id,
          body: 'Análise feita',
          isInternal: false,
          createdAt: '2026-07-13T11:00:00.000Z',
        },
      ],
    })

    expect(filterTicketsByScope([participatedTicket], 'participated', technician)).toEqual([participatedTicket])
    expect(userCanAccessTicket(participatedTicket, manager)).toBe(true)
  })

  it('considera aprovadores responsáveis apenas na etapa pendente correspondente', () => {
    const pendingApproval = ticket({
      appManagerId: manager.id,
      status: WORKFLOW_STEPS.awaiting_app_manager_approval,
    })
    const notPendingApproval = ticket({
      appManagerId: manager.id,
      status: WORKFLOW_STEPS.in_service,
    })

    expect(isTicketAssignedToUser(pendingApproval, manager)).toBe(true)
    expect(isTicketAssignedToUser(notPendingApproval, manager)).toBe(false)
  })
})
