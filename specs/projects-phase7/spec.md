# Spec: Projetos & Tarefas — Gestão Interna, Apontamentos e Valor Hora

**Status:** done
**Data:** 2026-04-03
**Fase do roadmap:** Fase 7 — Projetos & Tarefas

## Contexto

Após a entrega de tickets, workflow, SLA, cronômetros e notificações, a aplicação precisa cobrir trabalho interno que não nasce como ticket. A Fase 7 introduz gestão de projetos internos com tarefas, apontamentos por cronômetro já existente e base de valor hora para cálculo operacional.

## Requisitos Funcionais

- RF01: Permitir CRUD de projetos com `name`, `description?`, `costCenter`, `hourlyRate`.
- RF02: Permitir CRUD de tarefas dentro de um projeto (`title`, `description?`, `assigneeId?`).
- RF03: Exibir lista de projetos em `/projects` com filtros por centro de custo e status (ativo/arquivado quando aplicável).
- RF04: Exibir detalhe de projeto em `/projects/:id` com resumo, tarefas e total de horas apontadas.
- RF05: Permitir iniciar cronômetro para `project_task` a partir da tela de projeto/tarefa.
- RF06: Ao parar cronômetro de `project_task`, registrar apontamento na tarefa correspondente com `origin: "timer"`.
- RF07: Permitir lançamento manual de apontamento em tarefa (`date`, `startTime`, `endTime`, `totalMinutes`, `note?`).
- RF08: Permitir editar e remover apontamentos de tarefa.
- RF09: Calcular total de horas por tarefa e por projeto com base na soma de apontamentos.
- RF10: Aplicar `hourlyRate` do projeto para cálculo de valor estimado (horas * valor hora) no detalhe.
- RF11: Restringir criação/edição/exclusão de projetos e tarefas para `manager` e `admin` no Main Process.
- RF12: Permitir que `member` registre apontamentos e opere cronômetro apenas em tarefas às quais tenha acesso.

## Requisitos Não-funcionais

- RNF01: Regras de projeto/tarefa devem ficar no Main (`electron/services/project.ts`), não em componentes.
- RNF02: Renderer acessa dados de projeto somente por IPC tipado (`src/lib/ipc.ts` + preload).
- RNF03: Todos os payloads de CRUD e apontamento devem ser validados com Zod.
- RNF04: Tipos compartilhados devem ser centralizados em `shared/types/index.ts`, sem duplicação local.
- RNF05: Reuso do serviço de timer existente para `project_task`, sem lógica de tempo paralela no Renderer.
- RNF06: Operações devem atualizar `updatedAt` de tarefa e projeto de forma consistente.

## Casos de Uso

### UC01 — Criar projeto interno
**Ator:** Manager/Admin
**Fluxo principal:**
1. Usuário acessa `/projects` e seleciona "Novo projeto".
2. Preenche nome, centro de custo e valor hora.
3. Renderer chama `ipc.createProject(payload)`.
4. Main valida Zod, persiste no Cosmos DB e retorna projeto criado.

### UC02 — Criar tarefa do projeto
**Ator:** Manager/Admin
**Fluxo principal:**
1. Usuário abre `/projects/:id`.
2. Cria nova tarefa com responsável opcional.
3. Renderer chama `ipc.createProjectTask(payload)`.
4. Main valida e grava tarefa no projeto.

### UC03 — Apontar tempo com cronômetro
**Ator:** Usuário autenticado
**Fluxo principal:**
1. Usuário inicia timer em tarefa do projeto (`entityType: "project_task"`).
2. Timer roda no Main e envia ticks para UI.
3. Usuário pausa/retoma quando necessário.
4. Ao parar, Main cria apontamento automático na tarefa.
5. Totais de horas e valor estimado são recalculados.

### UC04 — Lançar apontamento manual
**Ator:** Member/Manager/Admin
**Fluxo principal:**
1. Usuário abre tarefa e seleciona "Adicionar apontamento".
2. Informa horários e observação.
3. Renderer chama `ipc.createProjectTaskAppointment(payload)`.
4. Main valida, grava apontamento e retorna tarefa atualizada.

### UC05 — Consultar acompanhamento do projeto
**Ator:** Member/Manager/Admin
**Fluxo principal:**
1. Usuário acessa detalhe do projeto.
2. UI exibe lista de tarefas, horas totais e valor estimado.
3. Usuário navega para detalhar apontamentos por tarefa.

## Modelo de Dados Afetado

### Reuso/ajustes de tipos existentes
- `Project` e `ProjectTask` já existem em `shared/types/index.ts` e serão operacionalizados nesta fase.
- `ProjectTask.appointments` usa `Appointment[]` para apontamentos de tempo.

### Campos derivados (não persistidos obrigatoriamente)
- `project.totalMinutes` (derivado da soma das tarefas)
- `project.estimatedValue` (derivado de `totalMinutes` e `hourlyRate`)

### Contrato IPC (novos métodos)
- `listProjects()`
- `getProjectById(projectId)`
- `createProject(payload)`
- `updateProject(payload)`
- `deleteProject(projectId)`
- `createProjectTask(payload)`
- `updateProjectTask(payload)`
- `deleteProjectTask(payload)`
- `createProjectTaskAppointment(payload)`
- `updateProjectTaskAppointment(payload)`
- `deleteProjectTaskAppointment(payload)`

## Critérios de Aceite

- [ ] CA01: Manager/Admin conseguem criar e editar projeto com centro de custo e valor hora.
- [ ] CA02: Member não consegue criar/editar/excluir projeto.
- [ ] CA03: Manager/Admin conseguem criar, editar e excluir tarefas do projeto.
- [ ] CA04: `member` consegue iniciar/parar cronômetro em tarefa permitida.
- [ ] CA05: Parar timer em `project_task` cria apontamento automático corretamente.
- [ ] CA06: Lançamento manual de apontamento atualiza totais da tarefa e do projeto.
- [ ] CA07: Detalhe do projeto exibe horas acumuladas e valor estimado coerentes.
- [ ] CA08: Operações inválidas (projeto/tarefa inexistente, sem permissão) retornam erro claro.
- [ ] CA09: Tela `/projects` deixa de ser placeholder e lista projetos reais.
- [ ] CA10: Tela `/projects/:id` deixa de ser placeholder e mostra tarefas + apontamentos.

## Dependências

- Requer: Fase 1 (auth), Fase 5 (timers), Fase 6 (contratos IPC estabilizados).
- Afeta: `electron/services`, `electron/ipc`, `electron/preload.ts`, `shared/types`, `src/pages/projects/*`, `src/stores/timerStore.ts`.

## Notas de implementação

- Criar `electron/services/project.ts` para CRUD e regras de autorização.
- Criar `electron/ipc/project-ipc.ts` com handlers de projeto/tarefa/apontamento.
- Registrar handlers em `electron/main.ts`.
- Atualizar `electron/preload.ts` e `shared/types/index.ts` com novos métodos IPC.
- Reusar `electron/services/timer.ts` para persistência de apontamentos em `project_task` no `stop`.
- Manter UI com componentes shadcn/ui e tokens (`text-primary`, `bg-muted`, etc.), sem hardcode de cor.
