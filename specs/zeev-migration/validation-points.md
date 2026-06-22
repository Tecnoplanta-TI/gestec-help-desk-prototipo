# Pontos de Validação — Migração Zeev

**Data:** 2026-06-17  
**Status:** Aguardando stakeholders

| # | Pergunta | Impacto | Default proposto |
|---|----------|---------|------------------|
| 1 | Quais centros de custo além do 47? | CRUD seed | Apenas 47 no seed |
| 2 | Opções do campo **Nível**? | Enum + UI | N1, N2, N3 (existente no tipo) |
| 3 | Número ticket: formato e sequência? | `ticket-number.ts` | `TKT-YYYY-NNNNN` anual |
| 4 | Data abertura automática? | Sim | `openedAt = createdAt` |
| 5 | Anexos obrigatórios por tipo? | Validação | Nenhum obrigatório |
| 6 | Regra 7 dias ajuste cancela ticket? | Job | Sim, feature flag |
| 7 | Discord mantido por prioridade? | Discord rules | Sim |
| 8 | Quem recebe cada notificação? | Routing e-mail | Por permissão |
| 9 | Quem pode "aprovar direto" cancelamento? | Permission | `cancellation_direct_approve` |
| 10 | Limiar NPS "baixa"? | AppConfig | ≤ 6 |
| 11 | Campos visíveis solicitante vs internos? | UI | cod* internos |
| 12 | Integrar ou substituir Zeev? | Arquitetura | **Substituir** (decidido) |
| 13 | Cancelamento Zeev manual ou API? | Escopo | Registro interno only |
| 14 | SLAs oficiais além contato inicial? | SLA rules | Usar SLA engine existente |
| 15 | Quem altera prioridade? | RBAC | Atendente + triador + admin |
| 16 | Reabrir ticket concluído? | Workflow | Admin only (*sugestão*) |
| 17 | Apontamento obrigatório para concluir? | Validação | Não (*default*) |
| 18 | Migrar histórico Zeev? | Escopo MVP | Fora do MVP |
| 19 | Justificativa cancelamento obrigatória? | Validação | Opcional |
| 20 | Tarefa pendente 7 dias cancela ticket? | Job | *Validar* — não no MVP |

## Como resolver

1. Workshop com TI + solicitantes
2. Atualizar [form-fields.md](./form-fields.md) e [decisions.md](./decisions.md)
3. Ajustar defaults em `AppConfig` seed
