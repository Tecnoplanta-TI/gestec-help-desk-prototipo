# Decisões de Design — Migração Zeev

**Data:** 2026-06-17

| # | Decisão | Alternativa | Justificativa |
|---|---------|-------------|---------------|
| 1 | Electron único para todos perfis | Web + Electron | Decisão stakeholder; app já maduro |
| 2 | Substituir Zeev 100% | Híbrido webhook | Decisão stakeholder |
| 3 | Manter Cosmos DB | Migrar SQL/Prisma | Consistência stack existente |
| 4 | RBAC via `permissions[]` | Novos UserRoles fixos | Flexibilidade; user pode ter múltiplos papéis |
| 5 | `ticket.status` = step ID Zeev | Status enum separado | Compatível workflow engine existente |
| 6 | Sub-entidades embutidas no Ticket | Containers separados | Padrão Cosmos atual; menos RU |
| 7 | Workflow Zeev seed automático | Manual admin | Garante paridade out-of-box |
| 8 | Form rules em módulo puro shared | Só no Renderer | Testável; espelhado no Zod Main |
| 9 | E-mail via nodemailer no Main | Serviço externo | Simplicidade; SMTP configurável |
| 10 | AuditLog container separado | Só workflowHistory | RF056 exige campo-level audit |
| 11 | Limiar NPS default 6 | Hardcoded 7 | Alinhado TicketEvaluation existente |
| 12 | Webhook descontinuado | Manter paralelo | Substituição total decidida |
| 13 | ticketNumber anual | Sequência global | Legibilidade por ano |
| 14 | Direct cancel via permission | Role admin only | Granularidade |
| 15 | Job 7 dias feature flag | Sempre ativo | validation-points #6 pendente |
| 16 | Filas filtram in-memory | Query Cosmos por status | MVP simpler; otimizar depois |
| 17 | Wizard modal + rota `/tickets/new` | Só modal | Flexibilidade deep link |
| 18 | Comentários embutidos | Container comments | Consistência appointments/tasks |

## Decisões pendentes

Ver [validation-points.md](./validation-points.md) — atualizar esta tabela após workshop.
