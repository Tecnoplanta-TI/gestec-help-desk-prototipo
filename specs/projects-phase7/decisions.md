# Decisões de Design — Projetos & Tarefas Fase 7

| # | Decisão | Alternativa considerada | Justificativa |
|---|---------|------------------------|---------------|
| 1 | Implementar serviço dedicado `electron/services/project.ts` | CRUD direto em handlers IPC | Centraliza regra de domínio e autorização |
| 2 | Reusar `Appointment` também em tarefas de projeto | Criar tipo paralelo de apontamento de projeto | Evita duplicação e mantém padrão único de tempo |
| 3 | Reusar timer existente com `entityType: "project_task"` | Criar segundo motor de timer para projetos | Mantém consistência de cálculo e menor custo de manutenção |
| 4 | Controle de escrita para `manager/admin`; `member` só aponta tempo | CRUD aberto para todos | Reduz risco de alteração estrutural indevida |
| 5 | Calcular totais de horas e valor estimado como dados derivados | Persistir totais a cada atualização | Evita divergência entre dados base e agregados |
| 6 | Começar com tarefas embutidas em `Project.tasks` | Container separado de tarefas na Fase 7 | Estrutura atual já usa embed e atende escopo inicial |
