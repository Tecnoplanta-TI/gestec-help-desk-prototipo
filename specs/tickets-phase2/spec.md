# Spec: Tickets — Abertura Manual + Webhook + Visualização

> **Nota (2026-06-17):** Superseded parcialmente por `specs/zeev-migration/` — webhook Zeev descontinuado; abertura completa no app próprio.

**Status:** done
**Data:** 2026-04-03
**Fase do roadmap:** Fase 2 — Tickets (abertura manual + webhook)

## Contexto

A aplicação precisa centralizar o ciclo operacional de tickets de TI. Nesta fase, os tickets devem entrar por webhook da plataforma externa ou por abertura manual do time interno, com visualização em lista, kanban e detalhe.

## Requisitos Funcionais

- RF01: Receber tickets via webhook em `POST /webhooks/ticket` no servidor Fastify interno.
- RF02: Persistir ticket recebido por webhook no Cosmos DB com `source: "external"`.
- RF03: Permitir abertura manual de ticket pelo time de TI no Renderer via IPC.
- RF04: Persistir ticket manual com `source: "manual"` e status inicial padrão.
- RF05: Exibir listagem de tickets com filtros por prioridade e status.
- RF06: Exibir tickets em Kanban por status.
- RF07: Exibir página de detalhe com todos os campos principais do ticket.
- RF08: Definir serviço de abstração da plataforma externa em `electron/services/platform-integration.ts`.
- RF09: Validar payloads de criação manual e webhook com Zod antes da persistência.

## Requisitos Não-funcionais

- RNF01: Renderer não acessa Node.js diretamente; toda operação de ticket usa IPC.
- RNF02: Rota de webhook protegida por header secret configurável.
- RNF03: Operações de listagem devem retornar dados ordenados por `createdAt DESC`.
- RNF04: Não expor secrets no Renderer.

## Casos de Uso

### UC01 — Receber ticket da plataforma externa
**Ator:** Plataforma externa de processos
**Fluxo principal:**
1. Plataforma chama `POST /webhooks/ticket` com payload do ticket.
2. API valida secret e payload.
3. Main converte payload externo em modelo interno via `platform-integration`.
4. Ticket é persistido no Cosmos e retorna `201`.

**Fluxo alternativo / exceção:**
- Secret inválido: `401`.
- Payload inválido: `400`.

### UC02 — Abertura manual de ticket
**Ator:** Membro/gestor/admin de TI
**Fluxo principal:**
1. Usuário abre formulário na tela de tickets.
2. Preenche campos obrigatórios e envia.
3. Renderer chama `ipc.createTicket(...)`.
4. Main valida com Zod e persiste ticket no Cosmos.
5. Ticket aparece na lista e no kanban.

### UC03 — Visualização em lista e kanban
**Ator:** Membro/gestor/admin
**Fluxo principal:**
1. Usuário acessa `/tickets` ou `/tickets/kanban`.
2. Renderer chama `ipc.listTickets()`.
3. Tickets são renderizados em tabela (lista) e colunas (kanban).

### UC04 — Detalhe do ticket
**Ator:** Membro/gestor/admin
**Fluxo principal:**
1. Usuário acessa `/tickets/:id`.
2. Renderer chama `ipc.getTicketById(id)`.
3. UI exibe dados completos do ticket.

## Modelo de Dados Afetado

- Container `tickets` no Cosmos DB (documentos do tipo `Ticket` definido em `shared/types/index.ts`).
- Novos contratos IPC para tickets em `ElectronAPI`:
  - `listTickets()`
  - `getTicketById(id)`
  - `createTicket(payload)`

## Critérios de Aceite

- [ ] CA01: `POST /webhooks/ticket` cria ticket com `source: "external"`.
- [ ] CA02: Secret inválido no webhook retorna `401`.
- [ ] CA03: Usuário autenticado consegue abrir ticket manual pela UI.
- [ ] CA04: Ticket manual criado aparece na lista sem recarregar a aplicação.
- [ ] CA05: Kanban agrupa tickets por status.
- [ ] CA06: Detalhe exibe campos principais sem erro de carregamento.
- [ ] CA07: Todos os payloads de entrada são validados por Zod no Main.

## Dependências

- Requer: Fase 1 concluída (autenticação e sessão).
- Afeta: `electron/api`, `electron/services`, `electron/ipc`, `src/pages/tickets`, `shared/types`.

## Notas de implementação

- Status inicial padrão: `triage`.
- Workflow inicial padrão nesta fase: `default` (placeholder até Fase 4).
- A integração externa deve ficar encapsulada em `platform-integration.ts` para suportar troca futura de fornecedor.
