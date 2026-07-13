import type { ServiceGroup, TicketLevel, TicketPriority, TicketType } from '../../shared/types'

export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  incident: 'Incidente',
  service_interruption: 'Interrupção de serviço',
  improvement: 'Melhoria',
  request: 'Solicitação',
  cancellation: 'Cancelamento de solicitação',
}

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  P1: 'P1 (alta prioridade)',
  P2: 'P2 (prioridade média)',
  P3: 'P3 (prioridade normal)',
  P4: 'P4 (prioridade baixa)',
}

export const LEVEL_LABEL: Record<TicketLevel, string> = {
  N1: 'N1',
  N2: 'N2',
  N3: 'N3',
}

export const SERVICE_GROUP_LABEL: Record<ServiceGroup, string> = {
  access_accounts: 'Acessos / Contas',
  acquisitions: 'Aquisição / Alocação',
  dashboards: 'Dashboard',
  emails: 'Email',
  gestec: 'Gestec',
  printers: 'Impressoras',
  maintenance_upgrade: 'Manutenção / Upgrade',
  software: 'Programas',
  network_internet: 'Rede / Internet',
  erp: 'SIGER',
  process_platform: 'Outro',
  other: 'Outro',
}

export const PRIORITY_CRITERIA: Array<{
  priority: TicketPriority
  title: string
  description: string
  sla: string
}> = [
  {
    priority: 'P1',
    title: 'P1 (alta prioridade)',
    description:
      'Situações de emergência que impedem completamente o trabalho do usuário ou afetam gravemente as operações essenciais da empresa, exigindo resposta imediata.',
    sla: 'Prazo para contato inicial: imediato',
  },
  {
    priority: 'P2',
    title: 'P2 (prioridade média)',
    description:
      'Problemas que têm impacto significativo no trabalho do usuário ou em operações críticas da empresa e precisam ser resolvidos o mais rápido possível, dentro de horas.',
    sla: 'Prazo para contato inicial: 4 a 8 horas úteis',
  },
  {
    priority: 'P3',
    title: 'P3 (prioridade normal)',
    description:
      'Questões que afetam o trabalho do usuário, mas podem esperar por solução dentro de prazo razoável, sem causar interrupções graves.',
    sla: 'Prazo para contato inicial: 1 a 3 dias',
  },
  {
    priority: 'P4',
    title: 'P4 (prioridade baixa)',
    description:
      'Problemas que não afetam diretamente o trabalho do usuário e podem ser resolvidos em prazo mais flexível, sem causar impacto significativo.',
    sla: 'Prazo para contato inicial: 3 a 5 dias',
  },
]

export const TICKET_TYPES: TicketType[] = [
  'incident',
  'service_interruption',
  'improvement',
  'request',
  'cancellation',
]

export const TICKET_PRIORITIES: TicketPriority[] = ['P1', 'P2', 'P3', 'P4']

export const TICKET_LEVELS: TicketLevel[] = ['N1', 'N2', 'N3']

export const SERVICE_GROUPS: ServiceGroup[] = [
  'access_accounts',
  'acquisitions',
  'dashboards',
  'emails',
  'gestec',
  'printers',
  'maintenance_upgrade',
  'software',
  'network_internet',
  'erp',
  'process_platform',
  'other',
]
