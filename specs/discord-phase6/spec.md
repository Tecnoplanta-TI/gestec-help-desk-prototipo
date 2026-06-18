# Spec: Notificações Discord — Regras, Condições e Templates

**Status:** done
**Data:** 2026-04-03
**Fase do roadmap:** Fase 6 — Notificações Discord

## Contexto

Após as fases de tickets, SLA, workflow e cronômetros, a operação precisa de alertas automáticos para eventos críticos de atendimento. Nesta fase, o sistema deve permitir cadastro de regras de notificação Discord com condições e templates, avaliando essas regras em eventos do ciclo do ticket.

## Requisitos Funcionais

- RF01: Permitir CRUD de regras de notificação Discord em `/settings/discord`.
- RF02: Cada regra deve conter `name`, `webhookUrl`, `triggerOn`, `conditions[]`, `messageTemplate`, `active`.
- RF03: Validar `webhookUrl` como URL HTTPS válida.
- RF04: Permitir múltiplas regras ativas para o mesmo `triggerOn`.
- RF05: Disparar avaliação de regras nos eventos:
  - `ticket_created`
  - `ticket_status_changed`
  - `ticket_assigned`
  - `ticket_sla_warning`
  - `ticket_sla_overdue`
  - `ticket_closed`
- RF06: Avaliar condições por regra (`field`, `operator`, `value`) usando dados do contexto do ticket.
- RF07: Suportar placeholders no template de mensagem:
  - `{ticket.*}`
  - `{requester.*}`
  - `{assignee.*}`
- RF08: Enviar payload para Discord webhook no formato compatível (`content`), respeitando limite de tamanho.
- RF09: Regras inativas (`active = false`) não devem ser avaliadas nem disparadas.
- RF10: CRUD de regras deve ser restrito a `admin` no Main Process.
- RF11: Leitura de regras para visualização deve exigir usuário autenticado.
- RF12: Em caso de falha no webhook Discord, não bloquear o fluxo principal do ticket.

## Requisitos Não-funcionais

- RNF01: Toda lógica de envio e interpolação deve ficar no Main (`electron/services/discord.ts`).
- RNF02: Renderer não acessa webhook diretamente.
- RNF03: Inputs de CRUD validados com Zod nos handlers IPC.
- RNF04: Avaliação de condição e interpolação devem ser funções puras e testáveis.
- RNF05: Sanitizar placeholders desconhecidos (substituir por vazio ou marcador seguro).
- RNF06: Erros de envio devem ser logados com contexto mínimo (id da regra/evento), sem expor secrets.

## Casos de Uso

### UC01 — Criar regra de notificação
**Ator:** Admin
**Fluxo principal:**
1. Admin acessa `/settings/discord`.
2. Preenche nome, webhook, evento, condições e template.
3. Renderer chama `ipc.createDiscordRule(payload)`.
4. Main valida Zod e persiste a regra.
5. UI atualiza lista de regras.

### UC02 — Disparar notificação por criação de ticket
**Ator:** Sistema
**Fluxo principal:**
1. Ticket é criado (manual ou webhook).
2. Main chama `discord.notify('ticket_created', context)`.
3. Serviço filtra regras ativas do evento.
4. Regras com condições atendidas disparam webhook com template interpolado.

### UC03 — Atualizar ou desativar regra
**Ator:** Admin
**Fluxo principal:**
1. Admin edita regra existente ou marca inativa.
2. Main persiste alteração.
3. Regra passa a refletir novo estado no próximo evento.

### UC04 — Falha no Discord webhook
**Ator:** Sistema
**Fluxo principal:**
1. Evento aciona notificação.
2. Discord retorna erro ou timeout.
3. Serviço registra log de erro e segue execução do fluxo principal (sem rollback de ticket).

## Modelo de Dados Afetado

### Container `discord_notification_rules`
```ts
{
  id: string,
  name: string,
  webhookUrl: string,
  triggerOn: 'ticket_created' | 'ticket_status_changed' | 'ticket_assigned' | 'ticket_sla_warning' | 'ticket_sla_overdue' | 'ticket_closed',
  conditions: Array<{ field: string, operator: 'equal' | 'not_equal' | 'in' | 'contains', value: string | string[] }>,
  messageTemplate: string,
  active: boolean,
  createdAt: string,
  updatedAt: string
}
```

### Contrato IPC (novos métodos)
- `listDiscordRules()`
- `createDiscordRule(payload)`
- `updateDiscordRule(payload)`
- `deleteDiscordRule(ruleId)`
- `testDiscordRule(payload)` (opcional para validar template/webhook sem evento real)

## Critérios de Aceite

- [ ] CA01: Admin consegue criar regra válida pela UI.
- [ ] CA02: Usuário não admin não consegue criar/editar/excluir regras.
- [ ] CA03: Evento `ticket_created` com condição atendida envia mensagem ao Discord.
- [ ] CA04: Regras inativas não disparam notificações.
- [ ] CA05: Template interpola corretamente placeholders de ticket/requester/assignee.
- [ ] CA06: Placeholder inexistente não quebra envio.
- [ ] CA07: Falha de webhook não interrompe criação/transição de ticket.
- [ ] CA08: Múltiplas regras do mesmo evento podem disparar no mesmo ciclo.
- [ ] CA09: Atualização de regra passa a valer para eventos subsequentes.
- [ ] CA10: URL inválida é rejeitada com erro claro de validação.

## Dependências

- Requer: Fase 2 (tickets), Fase 3 (SLA), Fase 4 (workflow).
- Afeta: `electron/services`, `electron/ipc`, `shared/types`, `src/pages/settings/DiscordNotificationsPage.tsx`, eventos de ticket.

## Notas de implementação

- Criar `electron/services/discord.ts` com:
  - `evaluateConditions(rule, context)`
  - `renderTemplate(template, context)`
  - `sendWebhook(webhookUrl, content)`
  - `notify(event, context)`
- Criar `electron/services/discord-rule.ts` para CRUD no Cosmos DB.
- Criar `electron/ipc/discord-ipc.ts` para gestão de regras via UI.
- Registrar handlers no `electron/main.ts`.
- Conectar `notify(...)` nos pontos de evento de ticket (create/transition/assignee/SLA status relevante).
- Definir política de retry simples (0 ou 1 tentativa) para evitar duplicidade excessiva.
