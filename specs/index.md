# Índice de Specs — gestec · help desk

Todas as specs de desenvolvimento, organizadas por fase do roadmap.
Criadas via skill `spec-creator` e validadas via skill `arch-review`.

| Feature | Arquivo | Status | Fase |
|---------|---------|--------|------|
| Autenticação & Usuários | specs/auth/spec.md | done | Fase 1 |
| Tickets — Abertura Manual + Webhook + Visualização | specs/tickets-phase2/spec.md | done | Fase 2 |
| SLA — Regras, Cálculo e Indicador Visual | specs/sla-phase3/spec.md | done | Fase 3 |
| Workflow Engine — Etapas, Transições, Condições e Aprovação | specs/workflow-phase4/spec.md | done | Fase 4 |
| Cronômetros — Múltiplos, Apontamento Automático e Janela Flutuante | specs/timers-phase5/spec.md | done | Fase 5 |
| Notificações Discord — Regras, Condições e Templates | specs/discord-phase6/spec.md | done | Fase 6 |
| Projetos & Tarefas — Gestão Interna, Apontamentos e Valor Hora | specs/projects-phase7/spec.md | done | Fase 7 |
| Despesas & Anexos — Registro de Custos e Comprovantes | specs/expenses-phase8/spec.md | review | Fase 8 |
| Migração Zeev — Fluxo completo substituindo plataforma externa | specs/zeev-migration/index.md | draft | Migração Zeev |

## Legenda de status
- `draft` — rascunho, aguardando review
- `review` — em revisão arquitetural (arch-review)
- `approved` — aprovada, pronta para desenvolvimento
- `in_progress` — em desenvolvimento
- `done` — implementada e testada

## Como criar uma nova spec
1. Execute a skill `spec-creator` no Claude Code
2. Execute a skill `arch-review` sobre a spec criada
3. Inicie o desenvolvimento somente após status `approved`
