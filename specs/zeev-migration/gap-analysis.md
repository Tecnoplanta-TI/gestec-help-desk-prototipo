# Gap Analysis — Zeev vs gestec · help desk

**Data:** 2026-06-17

## Resumo

| Área | Cobertura | Paridade Zeev |
|------|-----------|---------------|
| Abertura | Parcial | ~40% |
| Workflow | Parcial | ~50% |
| Aprovações | Metadata | ~20% |
| Triagem | Genérico | ~30% |
| Atendimento | Cronômetro | ~60% |
| Cancelamento | Inexistente | 0% |
| Avaliação NPS | Tipo only | ~10% |
| Discord | Completo | ~80% |
| E-mail | Inexistente | 0% |

## Tipos de solicitação

| Zeev | App | Gap |
|------|-----|-----|
| Incidente | `incident` | OK |
| Interrupção | `service_interruption` | OK |
| Melhoria | `improvement` | Sem aprovação enforced |
| Cancelamento Zeev | ausente | Adicionar `cancellation` |
| Solicitação | `request` | OK |

## Campos ausentes na UI

`service`, `unavailableSystem`, `inoperableInfrastructure`, `applicationProcess`, `improvementAcknowledged`, `appManagerId`, `ticketNumber`, `cancellationItems`, `tasks[]`, avaliação UI.

## Arquivos impactados

- `shared/types/index.ts`
- `electron/services/ticket.ts`, `workflow.ts`, novos: `form-rules.ts`, `approval.ts`, `email.ts`, `audit.ts`
- `src/pages/tickets/*`, novas rotas `/approvals`, `/triage`, `/service`, `/reports`

## Descontinuar

- `electron/api/routes/webhooks.ts`
- `electron/services/platform-integration.ts`
