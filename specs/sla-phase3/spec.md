# Spec: SLA — Regras, Cálculo e Indicador Visual

**Status:** done
**Data:** 2026-04-03
**Fase do roadmap:** Fase 3 — SLA

## Contexto

Após a implementação de tickets na Fase 2, o sistema precisa controlar prazo de atendimento para suportar priorização operacional, visibilidade de risco e governança de atendimento. Nesta fase, será entregue o cadastro de regras de SLA, cálculo automático de deadline e indicador visual de status de SLA na lista, kanban e detalhe dos tickets.

## Requisitos Funcionais

- RF01: Permitir cadastro de regras de SLA com os campos `name`, `priority?`, `serviceGroup?`, `deadlineHours`.
- RF02: Permitir listar, editar e remover regras de SLA na tela de configurações (`/settings/sla`).
- RF03: Aplicar regra de SLA automaticamente ao criar ticket manual.
- RF04: Aplicar regra de SLA automaticamente ao criar ticket via webhook externo.
- RF05: Definir `ticket.sla.deadline` a partir da `createdAt` + `deadlineHours` da regra selecionada.
- RF06: Definir `ticket.sla.status` com base no tempo restante:
  - `ok`: dentro do prazo
  - `warning`: <= 20% do prazo restante
  - `overdue`: prazo expirado
- RF07: Exibir indicador visual de SLA (badge) na lista, kanban e detalhe do ticket.
- RF08: Recalcular status de SLA ao buscar tickets para exibição.
- RF09: Quando não houver regra aplicável, ticket deve manter SLA com `status: "ok"` e `deadline` indefinido.
- RF10: CRUD de regras de SLA deve ser permitido apenas para usuários com papel `admin`.

## Requisitos Não-funcionais

- RNF01: Toda lógica de cálculo deve ficar em `src/lib/sla.ts` com funções puras (`calcDeadline`, `getSlaStatus`).
- RNF02: Persistência e seleção de regras de SLA devem ocorrer no Main Process.
- RNF03: Inputs de criação/edição de regra devem ser validados com Zod.
- RNF04: Renderer não pode acessar Cosmos DB diretamente.
- RNF05: Não usar valores visuais hardcoded para status; usar classes utilitárias/tokens já definidos.

## Casos de Uso

### UC01 — Cadastrar regra de SLA
**Ator:** Administrador
**Fluxo principal:**
1. Admin acessa `/settings/sla`.
2. Cadastra nome e prazo em horas, podendo restringir por prioridade e/ou grupo de serviço.
3. Renderer chama `ipc.createSlaRule(payload)`.
4. Main valida Zod e persiste no container de SLA.
5. UI atualiza lista de regras.

### UC02 — Aplicar SLA na criação do ticket
**Ator:** Sistema
**Fluxo principal:**
1. Ticket é criado (manual ou webhook).
2. Main busca regra de SLA aplicável por combinação de prioridade/grupo de serviço.
3. Main calcula deadline e grava `ticket.sla`.

**Fluxo alternativo:**
- Sem regra aplicável: ticket segue com `deadline` vazio e `status: "ok"`.

### UC03 — Visualizar estado de SLA no ticket
**Ator:** Membro/Gestor/Admin
**Fluxo principal:**
1. Usuário abre lista, kanban ou detalhe.
2. Renderer renderiza `SlaIndicator` com base em `ticket.sla.status`.
3. Interface apresenta cor e rótulo do status atual.

## Modelo de Dados Afetado

### Container `sla_rules`
```ts
{
  id: string,
  name: string,
  priority?: 'P1' | 'P2' | 'P3' | 'P4',
  serviceGroup?: ServiceGroup,
  deadlineHours: number
}
```

### Alterações em `Ticket`
- Campo já existente `sla` será preenchido na criação:
  - `deadline?: string`
  - `status: 'ok' | 'warning' | 'overdue'`

### Contrato IPC (novos métodos)
- `listSlaRules()`
- `createSlaRule(payload)`
- `updateSlaRule(payload)`
- `deleteSlaRule(id)`

## Critérios de Aceite

- [ ] CA01: Admin consegue criar uma regra de SLA válida pela UI.
- [ ] CA02: Ticket manual criado com regra aplicável recebe `deadline` e `status` corretos.
- [ ] CA03: Ticket de webhook criado com regra aplicável recebe `deadline` e `status` corretos.
- [ ] CA04: Tickets sem regra aplicável permanecem com `status: "ok"` sem erro.
- [ ] CA05: Indicador de SLA aparece na lista de tickets.
- [ ] CA06: Indicador de SLA aparece no kanban.
- [ ] CA07: Indicador de SLA aparece no detalhe do ticket.
- [ ] CA08: Alterar relógio para cenário vencido muda status para `overdue`.
- [ ] CA09: Alterar relógio para <=20% do prazo muda status para `warning`.
- [ ] CA10: Todas as entradas de regra inválidas são bloqueadas com erro claro.

## Dependências

- Requer: Fase 2 concluída (`tickets-phase2`).
- Afeta: `electron/services`, `electron/ipc`, `shared/types`, `src/lib/sla.ts`, `src/pages/settings/SlaPage.tsx`, `src/pages/tickets/*`, `src/components/tickets/SlaIndicator.tsx`.

## Notas de implementação

- Ordem de matching sugerida para regra aplicável:
  1. prioridade + grupo de serviço
  2. prioridade apenas
  3. grupo de serviço apenas
  4. fallback sem filtro (se existir)
- Critério de desempate no mesmo nível de especificidade: regra com `updatedAt` mais recente vence.
- `deadlineHours` deve aceitar apenas valores positivos (> 0).
- `SlaIndicator` deve centralizar mapeamento de rótulo/cor por status.
- `SlaIndicator` deve ser implementado em `src/components/tickets/SlaIndicator.tsx` e consumido em lista/kanban/detalhe.
- Revisão arquitetural (`arch-review`) deve ser executada após aprovação desta spec e antes de codar.
