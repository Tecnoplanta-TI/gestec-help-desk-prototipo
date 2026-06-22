# Modelo de Dados — Migração Zeev

**Data:** 2026-06-17  
**Persistência:** Azure Cosmos DB (documentos)

## Containers

| Container | Entidade | Partition key |
|-----------|----------|---------------|
| `tickets` | Ticket | `/id` |
| `users` | User | `/id` |
| `workflows` | Workflow | `/id` |
| `cost_centers` | CostCenter | `/id` |
| `audit_logs` | AuditLog | `/entityId` |
| `notification_logs` | NotificationLog | `/id` |
| `app_config` | AppConfig | `/id` |

## Enums novos/estendidos

```ts
type TicketType = 'incident' | 'service_interruption' | 'improvement' | 'request' | 'cancellation'
type TicketService = 'infrastructure' | 'system'
type UnavailableSystem = '3cx' | 'ecommerce' | 'insoft' | 'kinghost' | 'other' | 'pdv_siger' | 'siger'
type InoperableInfrastructure = 'internet' | 'other' | 'network' | 'time_clocks' | 'local_server' | 'ts' | 'vm' | 'vpn'
type TicketTaskStatus = 'pending' | 'done' | 'cancelled'
type ZeevTicketStatus = /* ver workflow.md — step IDs */
```

## Permission keys

```ts
const PERMISSIONS = [
  'requester', 'it_manager', 'app_manager', 'triage',
  'agent', 'cancellation_approver', 'admin',
  'cancellation_direct_approve',
] as const
```

## Ticket (campos estendidos)

| Campo | Tipo | Obrigatório | Origem |
|-------|------|-------------|--------|
| `ticketNumber` | string | Sim | sugestão |
| `openedAt` | ISO datetime | Sim | identificado |
| `requesterUserId` | string | Sim | inferido |
| `service` | TicketService | Condicional | identificado |
| `unavailableSystem` | UnavailableSystem | Condicional | identificado |
| `inoperableInfrastructure` | InoperableInfrastructure | Condicional | identificado |
| `applicationProcess` | string | Condicional | identificado |
| `improvementAcknowledged` | boolean | Condicional | identificado |
| `appManagerId` | string | Condicional | identificado |
| `appManagerCode` | string | Auto | identificado |
| `triageAssigneeId` | string | Condicional | identificado |
| `isCancelled` | boolean | Default false | identificado |
| `cancellationItems` | TicketCancellationItem[] | Condicional | identificado |
| `cancellationApproverId` | string | Condicional | identificado |
| `directCancellation` | boolean | Condicional | identificado |
| `tasks` | TicketTask[] | Default [] | identificado |
| `comments` | TicketComment[] | Default [] | inferido |
| `adjustmentRequestedAt` | ISO datetime | Condicional | inferido |
| `adjustmentDeadline` | ISO datetime | Condicional | inferido |
| `itManagerDecision` | ApprovalDecision | Condicional | inferido |
| `appManagerDecision` | ApprovalDecision | Condicional | inferido |
| `zeevStatus` | string | Opcional | interno — step ID atual |

Campos existentes reutilizados: `level`, `assetCode`, `downtimeMinutes`, `supportNotes`, `appointments`, `evaluation`, `workflowHistory`.

## TicketCancellationItem

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `id` | uuid | Sim |
| `zeevRequestNumber` | string | Sim |
| `justification` | string | Não (*validar*) |
| `status` | `pending` \| `approved` \| `rejected` | Sim |
| `processedAt` | ISO datetime | Condicional |

## TicketTask

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `id` | uuid | Sim |
| `description` | string | Sim |
| `assigneeId` | string | Não |
| `assigneeCode` | string | Auto | codresponsavel |
| `dueDate` | ISO date | Sim |
| `status` | TicketTaskStatus | Sim |
| `createdAt` | ISO datetime | Sim |
| `updatedAt` | ISO datetime | Sim |

## ApprovalDecision

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `approved` | boolean | Sim |
| `justification` | string | Condicional (recusa) |
| `decidedBy` | userId | Sim |
| `decidedAt` | ISO datetime | Sim |

## TicketComment

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `id` | uuid | Sim |
| `authorId` | string | Sim |
| `body` | string | Sim |
| `isInternal` | boolean | Sim |
| `createdAt` | ISO datetime | Sim |

## AuditLog

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `id` | uuid | Sim |
| `entityType` | `ticket` \| `user` | Sim |
| `entityId` | string | Sim |
| `action` | string | Sim |
| `field` | string | Opcional |
| `oldValue` | string | Opcional |
| `newValue` | string | Opcional |
| `userId` | string | Sim |
| `workflowStep` | string | Opcional |
| `justification` | string | Opcional |
| `createdAt` | ISO datetime | Sim |

## CostCenter

Já definido em `shared/types/index.ts`: `id`, `code`, `name`, `active`.

## AppConfig (singleton)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `npsLowScoreThreshold` | number | Default 6 |
| `adjustmentTimeoutDays` | number | Default 7 |
| `defaultTriageAssigneeId` | string | Opcional |
| `defaultCancellationApproverId` | string | Opcional |
| `emailEnabled` | boolean | Feature flag |
| `smtpHost`, `smtpPort`, etc. | string | Config e-mail |

## Relacionamentos

```
User 1──N Ticket (requesterUserId)
User 1──N Ticket (assigneeId, triageAssigneeId, appManagerId)
Ticket 1──N TicketTask (embutido)
Ticket 1──N TicketCancellationItem (embutido)
Ticket 1──N Appointment (embutido)
Ticket 1──N TicketComment (embutido)
Workflow 1──N Ticket (workflowId)
```

## Payloads IPC novos

- `CreateTicketPayload` — estendido com campos Zeev
- `UpdateTicketPayload` — ajuste solicitante, prioridade
- `ApproveTicketPayload` — `{ ticketId, approved, justification? }`
- `TriageTicketPayload` — `{ ticketId, decision, assigneeId?, justification? }`
- `CreateTicketTaskPayload`, `UpdateTicketTaskPayload`
- `CreateTicketAppointmentPayload`, `UpdateTicketAppointmentPayload`
- `SubmitTicketEvaluationPayload`
- `ListTicketsFilterPayload` — `{ queue?: 'triage' | 'service' | 'approvals_it' | ... }`
