# Decisões de Design — Tickets Fase 2

| # | Decisão | Alternativa considerada | Justificativa |
|---|---------|------------------------|---------------|
| 1 | Criar rotas de webhook no Fastify interno | Consumir webhook direto no IPC | Webhook é HTTP externo ao Renderer; Fastify é a camada correta |
| 2 | Persistir tickets em container dedicado `tickets` | Reutilizar container genérico | Mantém consultas e evolução de domínio organizadas |
| 3 | Usar status inicial `triage` | `open` | Alinha com linguagem de fluxo de suporte e roadmap de workflow |
| 4 | Formulário manual simplificado no `/tickets` nesta fase | Fluxo em modal complexo | Entrega rápida dos casos principais da fase 2 |
| 5 | Kanban com colunas fixas nesta fase | Colunas dinâmicas de workflow | Workflow engine só chega na fase 4 |