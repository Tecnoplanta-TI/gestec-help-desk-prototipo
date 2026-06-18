# Spec: Cronômetros — Múltiplos, Apontamento Automático e Janela Flutuante

**Status:** done
**Data:** 2026-04-03
**Fase do roadmap:** Fase 5 — Cronômetros

## Contexto

Com tickets e workflows já implementados, a operação precisa registrar tempo de atendimento de forma confiável para faturamento e auditoria. Nesta fase, o sistema deve suportar cronômetros simultâneos por ticket/tarefa, persistência no Cosmos DB, geração automática de apontamentos ao parar e janela flutuante always-on-top para acompanhamento rápido.

## Requisitos Funcionais

- RF01: Permitir iniciar cronômetro para entidade `ticket` ou `project_task` com `entityId`, `entityType`, `entityTitle`.
- RF02: Permitir múltiplos cronômetros simultâneos por usuário autenticado.
- RF03: Permitir pausar cronômetro mantendo tempo acumulado.
- RF04: Permitir retomar cronômetro pausado sem perder histórico de sessões.
- RF05: Permitir parar cronômetro e removê-lo da lista de ativos.
- RF06: Ao parar cronômetro de `ticket`, criar automaticamente `Appointment` com:
  - `origin: "timer"`
  - `date`, `startTime`, `endTime`, `totalMinutes`, `technicianId`
- RF07: Atualizar `ticket.updatedAt` após criação automática de apontamento por timer.
- RF08: Expor listagem de cronômetros ativos (`getActiveTimers`) para bootstrap do app.
- RF09: Publicar evento periódico `timer:tick` do Main para Renderer com o estado atualizado dos cronômetros ativos.
- RF10: Implementar controle de janela flutuante com abrir/fechar/pin (always-on-top) via IPC.
- RF11: Permitir abrir a janela flutuante a partir da UI principal e operar `play/pause/stop` nela.
- RF12: Garantir que timers sobrevivam ao restart da aplicação (persistidos no Cosmos DB).
- RF13: Impedir operação sobre cronômetro inexistente ou pertencente a outro usuário.
- RF14: Restringir operações de timer a usuário autenticado (`member`, `manager`, `admin`).

## Requisitos Não-funcionais

- RNF01: Lógica de timer no Main Process (`electron/services/timer.ts`), sem cálculo de tempo no Renderer.
- RNF02: Renderer só acessa timer via IPC tipado (`src/lib/ipc.ts` + `preload`).
- RNF03: Tick de atualização deve ser estável (intervalo fixo) sem bloquear UI.
- RNF04: Persistência deve usar container dedicado `active_timers` no Cosmos DB.
- RNF05: Validação de inputs com Zod em todos os handlers IPC.
- RNF06: Operações de timer devem ser idempotentes quando possível (`pause` em timer já pausado não quebra).
- RNF07: A janela flutuante não pode expor APIs além do contrato `ElectronAPI`.

## Casos de Uso

### UC01 — Iniciar cronômetro
**Ator:** Usuário autenticado
**Fluxo principal:**
1. Usuário aciona iniciar timer em ticket/tarefa.
2. Renderer chama `ipc.startTimer(entityId, entityType, entityTitle)`.
3. Main valida sessão, cria/atualiza timer em `active_timers`.
4. Evento `timer:tick` atualiza UI.

### UC02 — Pausar e retomar cronômetro
**Ator:** Usuário autenticado
**Fluxo principal:**
1. Usuário pausa timer.
2. Main acumula segundos da sessão atual e muda estado para `paused`.
3. Usuário retoma o timer.
4. Main define novo `startedAt` e estado `running`.

### UC03 — Parar cronômetro de ticket
**Ator:** Usuário autenticado
**Fluxo principal:**
1. Usuário para timer.
2. Main calcula total de minutos (acumulado + sessão atual).
3. Main cria `Appointment` no ticket com origem `timer`.
4. Main remove timer do container de ativos.
5. Renderer recebe atualização e remove timer da UI.

### UC04 — Reabrir aplicação com timers em andamento
**Ator:** Sistema
**Fluxo principal:**
1. App inicia e Renderer chama `ipc.getActiveTimers()`.
2. Main retorna timers persistidos do usuário.
3. UI sincroniza `timerStore` e continua exibição.

### UC05 — Operar janela flutuante
**Ator:** Usuário autenticado
**Fluxo principal:**
1. Usuário abre janela flutuante.
2. Janela exibe timers ativos com ações rápidas.
3. Usuário alterna `pin/unpin`.
4. Main aplica always-on-top e retorna estado.

## Modelo de Dados Afetado

### Container `active_timers`
```ts
{
  id: string,
  entityId: string,
  entityType: 'ticket' | 'project_task',
  entityTitle: string,
  state: 'running' | 'paused' | 'stopped',
  startedAt: string,
  accumulatedSeconds: number,
  technicianId: string,
  createdAt: string,
  updatedAt: string
}
```

### Alterações em `Ticket`
- Reuso de `appointments: Appointment[]` já existente.
- Inclusão automática de appointment com `origin: "timer"` ao `stop`.

### Contrato IPC
- Métodos já previstos e a implementar no Main:
  - `startTimer(entityId, entityType, entityTitle)`
  - `pauseTimer(timerId)`
  - `stopTimer(timerId)`
  - `getActiveTimers()`
  - `onTimerTick(callback)`
- Janela flutuante (já prevista):
  - `openFloatingWindow()`
  - `closeFloatingWindow()`
  - `toggleFloatingPin(pinned)`

## Critérios de Aceite

- [ ] CA01: Usuário autenticado consegue iniciar múltiplos timers simultaneamente.
- [ ] CA02: Pausar timer mantém tempo acumulado e retomar continua a contagem.
- [ ] CA03: Parar timer de ticket cria `Appointment` automático com origem `timer`.
- [ ] CA04: `totalMinutes` do appointment corresponde ao tempo efetivo acumulado do timer.
- [ ] CA05: Timer parado deixa de aparecer em `getActiveTimers`.
- [ ] CA06: Após restart da aplicação, timers ativos são restaurados no store.
- [ ] CA07: Evento `timer:tick` mantém UI sincronizada sem travamentos.
- [ ] CA08: Usuário não consegue manipular timer de outro técnico.
- [ ] CA09: Janela flutuante abre, fecha e alterna pin corretamente.
- [ ] CA10: Ações de timer inválidas retornam erro claro (`TIMER_NOT_FOUND`, `FORBIDDEN`, etc.).

## Dependências

- Requer: Fase 1 (auth), Fase 2 (tickets), Fase 4 (workflow).
- Afeta: `electron/services`, `electron/ipc`, `electron/main.ts`, `electron/preload.ts`, `src/stores/timerStore.ts`, `src/pages/tickets/*`, `src/pages/projects/*`, janela flutuante renderer.

## Notas de implementação

- Criar `electron/services/timer.ts` para regras de start/pause/stop/persistência.
- Criar `electron/ipc/timer-ipc.ts` com validação Zod + autorização por sessão.
- Registrar `registerTimerHandlers()` no `electron/main.ts`.
- Emitir `timer:tick` para todas as janelas ativas (principal e flutuante).
- Implementar renderer da rota/janela flutuante e garantir carregamento correto em dev/prod.
- Ao `stop` em `project_task`, devolver appointment calculado (sem anexar a ticket), preparando Fase 7.
