# Workflow e Estados — Migração Zeev

**Data:** 2026-06-17

## Step IDs do workflow default Zeev

IDs estáveis usados em `ticket.status`:

| Step ID | Nome exibido | Tipo |
|---------|--------------|------|
| `draft` | Rascunho | manual |
| `open` | Aberto | automatic |
| `awaiting_it_manager_approval` | Aguardando Gestor TI | approval |
| `improvement_rejected_by_it` | Melhoria recusada (TI) | manual |
| `awaiting_app_manager_approval` | Aguardando Gestor App | approval |
| `improvement_rejected_by_app` | Melhoria recusada (App) | manual |
| `improvement_approved` | Melhoria aprovada | automatic |
| `in_triage` | Em triagem | manual |
| `triage_rejected` | Recusado na triagem | manual |
| `awaiting_requester_adjustment` | Aguardando ajuste | manual |
| `adjustment_pending` | Ajuste em andamento | manual |
| `cancelled_adjustment_timeout` | Cancelado (prazo ajuste) | manual |
| `awaiting_cancellation_approval` | Aguardando aprovação cancelamento | approval |
| `cancellation_approved` | Cancelamento aprovado | automatic |
| `cancellation_rejected` | Cancelamento recusado | manual |
| `cancellation_completed` | Cancelamento concluído | manual |
| `awaiting_service` | Aguardando atendimento | manual |
| `in_service` | Em atendimento | manual |
| `resolved` | Resolvido | manual |
| `awaiting_evaluation` | Aguardando avaliação | manual |
| `completed` | Concluído | manual |
| `cancelled` | Cancelado | manual |

## Roteamento pós-criação (por tipo)

| Tipo | Status inicial após `open` |
|------|---------------------------|
| `improvement` | `awaiting_it_manager_approval` |
| `cancellation` | `awaiting_cancellation_approval` ou `cancellation_completed` se direct |
| Demais | `in_triage` |

Após criação, ticket passa por `open` (notificação Discord) e roteia automaticamente.

## Transições principais

### Melhoria

```
open → awaiting_it_manager_approval
awaiting_it_manager_approval → awaiting_app_manager_approval (aprovar TI)
awaiting_it_manager_approval → improvement_rejected_by_it (recusar)
awaiting_it_manager_approval → awaiting_requester_adjustment (ajuste)
awaiting_app_manager_approval → improvement_approved → in_triage (aprovar App)
awaiting_app_manager_approval → improvement_rejected_by_app (recusar)
```

### Triagem

```
in_triage → awaiting_service (aprovar + assigneeId)
in_triage → triage_rejected (recusar)
in_triage → awaiting_requester_adjustment (ajuste)
awaiting_requester_adjustment → adjustment_pending (solicitante abre)
adjustment_pending → in_triage (reenvia)
adjustment_pending → cancelled_adjustment_timeout (job 7d)
```

### Atendimento

```
awaiting_service → in_service (iniciar)
in_service → resolved (concluir)
resolved → awaiting_evaluation (automático)
awaiting_evaluation → completed (avaliação enviada)
```

### Cancelamento

```
open → awaiting_cancellation_approval
open → cancellation_completed (direct + permissão)
awaiting_cancellation_approval → cancellation_approved → cancellation_completed
awaiting_cancellation_approval → cancellation_rejected
```

## Permissões por transição

| De → Para | Permissão requerida |
|-----------|---------------------|
| → awaiting_app_manager_approval | `it_manager` |
| → improvement_rejected_by_it | `it_manager` |
| → in_triage (pós App) | `app_manager` |
| → improvement_rejected_by_app | `app_manager` |
| Triagem * | `triage` |
| → in_service | `agent` ou assignee |
| → completed | `requester` (próprio ticket) |
| Cancelamento aprovação | `cancellation_approver` |
| Direct cancel | `cancellation_direct_approve` |

## Campos obrigatórios para avançar

| Etapa | Campos |
|-------|--------|
| Criação | type, priority, serviceGroup, description + condicionais |
| Aprovação recusa | justification |
| Triagem aprovar | assigneeId |
| Concluir atendimento | — (*apontamentos: validar*) |
| Avaliação | metExpectation, score; npsJustification se score ≤ threshold |

## Job agendado

**adjustment_timeout_job** — executa diariamente:
- Tickets em `adjustment_pending` com `adjustmentDeadline < now`
- Transição → `cancelled_adjustment_timeout`
- Notificação e-mail `ajuste_7_dias`

## Diagrama BPMN simplificado

Ver [index.md](./index.md) e plano original — fluxo: criação → roteamento por tipo → aprovações (melhoria) ou triagem → atendimento → avaliação → concluído.

## Seed

Workflow default criado por `ensureZeevDefaultWorkflow()` na inicialização do app se nenhum default existir.
