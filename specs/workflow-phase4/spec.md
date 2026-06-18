# Spec: Workflow Engine — Etapas, Transições, Condições e Aprovação

**Status:** done
**Data:** 2026-04-03
**Fase do roadmap:** Fase 4 — Fluxos de Trabalho

## Contexto

Após a entrega de Tickets (Fase 2) e SLA (Fase 3), o sistema precisa suportar fluxos de atendimento configuráveis para refletir processos reais de suporte, incluindo aprovação para solicitações de melhoria e roteamento por regras. Nesta fase, será entregue o cadastro/edição de workflows, motor de transição de etapas e aplicação das etapas no ciclo do ticket.

## Requisitos Funcionais

- RF01: Permitir CRUD de workflows em `/settings/workflows` com os campos `name`, `description?`, `isDefault`, `steps`, `transitions`.
- RF02: Permitir definir etapas com `name`, `type` (`manual` | `approval` | `automatic`), `defaultAssigneeId?`, `slaHours?`, `order`.
- RF03: Permitir definir transições entre etapas com condições (`field`, `operator`, `value`).
- RF04: Garantir que cada workflow tenha ao menos 1 etapa e ao menos 1 etapa inicial (`order = 1`).
- RF05: Permitir marcar apenas um workflow como padrão (`isDefault = true`).
- RF06: Ao criar ticket, aplicar workflow padrão e setar `ticket.workflowId` + etapa inicial em `ticket.status`.
- RF07: Permitir mover ticket entre etapas apenas se houver transição válida para a etapa de destino.
- RF08: Para tickets com `type = "improvement"`, permitir fluxo com etapa de aprovação antes da triagem técnica.
- RF09: Ao mudar etapa, recalcular `ticket.sla.deadline` se a etapa destino tiver `slaHours` definido.
- RF10: Expor histórico básico de transições no ticket (etapa origem, etapa destino, data e usuário executor).
- RF11: Restringir CRUD de workflows para `admin` no Main Process.
- RF12: Permitir que `manager` e `admin` executem transições de etapa; `member` apenas quando regra explícita futura permitir (nesta fase: bloqueado).

## Requisitos Não-funcionais

- RNF01: Toda validação de estrutura de workflow deve ocorrer no Main Process com Zod.
- RNF02: Renderer não acessa Cosmos DB diretamente; toda operação via IPC tipado.
- RNF03: Motor de transições deve ser serviço dedicado (`electron/services/workflow.ts`).
- RNF04: Definição de status visual deve permanecer desacoplada da engine (UI apenas consome estado).
- RNF05: Leitura de tickets para lista/kanban não deve aumentar custo de RU de forma significativa por join manual em memória.
- RNF06: Operações de transição devem registrar `updatedAt` consistente no ticket.

## Casos de Uso

### UC01 — Criar workflow
**Ator:** Admin
**Fluxo principal:**
1. Admin acessa `/settings/workflows`.
2. Cria workflow com nome e etapas mínimas.
3. Define transições e condições.
4. Salva via `ipc.createWorkflow(payload)`.
5. Main valida, persiste e retorna workflow criado.

**Fluxo alternativo / exceção:**
- Workflow sem etapa inicial: erro de validação.
- Transição para etapa inexistente: erro de validação.

### UC02 — Definir workflow padrão
**Ator:** Admin
**Fluxo principal:**
1. Admin seleciona um workflow existente.
2. Marca como padrão.
3. Main garante unicidade de `isDefault = true`.

### UC03 — Criar ticket com workflow aplicado
**Ator:** Sistema
**Fluxo principal:**
1. Ticket é criado (manual ou webhook).
2. Main busca workflow padrão.
3. Main atribui `workflowId` e etapa inicial no `status`.
4. Ticket é persistido com fluxo inicial aplicado.

### UC04 — Transicionar etapa do ticket
**Ator:** Manager/Admin
**Fluxo principal:**
1. Usuário abre ticket e solicita mudança para etapa alvo.
2. Renderer chama `ipc.transitionTicketStep({ ticketId, toStepId })`.
3. Main valida permissão e transição permitida pelo workflow.
4. Main atualiza status do ticket e registra evento de transição.
5. Ticket atualizado é retornado para a UI.

**Fluxo alternativo / exceção:**
- Transição inválida para etapa destino: erro `TRANSITION_NOT_ALLOWED`.
- Usuário sem permissão: erro `FORBIDDEN`.

### UC05 — Fluxo com aprovação para melhoria
**Ator:** Sistema + Manager/Admin
**Fluxo principal:**
1. Ticket com `type = improvement` entra em etapa de aprovação.
2. Aprovador executa transição para etapa seguinte.
3. Ticket segue para triagem técnica apenas após aprovação.

## Modelo de Dados Afetado

### Container `workflows`
Usa o contrato `Workflow` já existente em `shared/types/index.ts`:
- `WorkflowStep`
- `WorkflowTransition`
- `WorkflowCondition`

### Alterações em `Ticket`
- Campo já existente `workflowId` passa a referenciar workflow ativo.
- Campo `status` continua representando etapa atual (ID da etapa no workflow).
- Novo campo sugerido para rastreabilidade:
```ts
workflowHistory?: Array<{
  id: string
  fromStepId: string
  toStepId: string
  changedBy: string
  changedAt: string
}>
```

### Contrato IPC (novos métodos)
- `listWorkflows()`
- `createWorkflow(payload)`
- `updateWorkflow(payload)`
- `deleteWorkflow(workflowId)`
- `setDefaultWorkflow(workflowId)`
- `transitionTicketStep(payload)`

## Critérios de Aceite

- [ ] CA01: Admin consegue criar workflow válido com etapas e transições.
- [ ] CA02: Sistema impede salvar workflow com referência quebrada (`fromStepId`/`toStepId` inexistente).
- [ ] CA03: Apenas um workflow pode ficar marcado como padrão.
- [ ] CA04: Ticket criado (manual e webhook) recebe `workflowId` + etapa inicial corretamente.
- [ ] CA05: Manager/Admin conseguem transicionar ticket quando houver transição permitida.
- [ ] CA06: Sistema bloqueia transição não permitida e retorna erro claro.
- [ ] CA07: Member não consegue transicionar ticket nesta fase.
- [ ] CA08: Ticket `improvement` pode seguir fluxo com etapa de aprovação antes da triagem.
- [ ] CA09: Mudança de etapa com `slaHours` recalcula deadline de SLA.
- [ ] CA10: Histórico de transições é registrado e pode ser exibido no detalhe do ticket.

## Dependências

- Requer: Fase 2 (tickets) e Fase 3 (SLA) concluídas.
- Afeta: `electron/services`, `electron/ipc`, `electron/api/routes`, `shared/types`, `src/pages/settings/WorkflowsPage.tsx`, `src/pages/tickets/*`.

## Notas de implementação

- Introduzir `electron/services/workflow.ts` para validação estrutural e resolução de transições.
- Introduzir `electron/ipc/workflow-ipc.ts` para CRUD e ações da engine.
- Registrar handlers no `electron/main.ts` sem concentrar lógica de domínio no arquivo principal.
- Atualizar `electron/preload.ts` e `shared/types/index.ts` com os novos métodos IPC.
- Reaproveitar `src/lib/sla.ts` para recálculo do SLA por etapa.
- Critério de seleção do workflow padrão: se nenhum existir, bloquear criação de ticket com erro operacional explícito e instrução para configuração.
