# Spec: Migração Zeev — Requisitos Funcionais e Critérios de Aceite

**Status:** draft  
**Data:** 2026-06-17  
**Fase:** Migração Zeev (substituição integral)

## Contexto

Substituir 100% do fluxo Zeev (abertura, aprovações, triagem, atendimento, cancelamento, avaliação) no aplicativo Electron existente, mantendo lógica de negócio e modernizando UX.

**Decisões:** Electron único; Zeev descontinuado; Cosmos DB mantido.

## Requisitos Funcionais

### Abertura e formulário

- **RF001** — Permitir solicitante abrir ticket autenticado.
- **RF002** — Gerar número sequencial `TKT-YYYY-NNNNN` (*sugestão*).
- **RF003** — Selecionar centro de custo de lista configurável.
- **RF004** — Tipo: Incidente, Interrupção, Melhoria, Cancelamento Zeev, Solicitação.
- **RF005** — Campos condicionais por tipo/serviço (ver [form-fields.md](./form-fields.md)).
- **RF006** — Checkbox ciência obrigatório em Melhoria.
- **RF007** — Exibir critérios P1–P4 com SLA de contato inicial.
- **RF008** — Anexos múltiplos (MIME/tamanho validados).
- **RF009** — `openedAt` automático na criação.
- **RF010** — Solicitante = usuário logado; admin pode abrir em nome de outro.

### Workflow melhoria

- **RF011** — Melhoria → `awaiting_it_manager_approval`.
- **RF012** — Gestor TI: aprovar/recusar/ajuste + justificativa.
- **RF013** — Aprovada TI → `awaiting_app_manager_approval`.
- **RF014** — Gestor App: aprovar/recusar/ajuste.
- **RF015** — Dupla aprovação → triagem.
- **RF016** — Notificar recusa TI/App.

### Triagem e ajuste

- **RF017** — Fila triagem (`/triage`).
- **RF018** — Triador: aprovar/recusar/ajuste.
- **RF019** — Definir `assigneeId` na triagem.
- **RF020** — Registrar `triageAssigneeId`.
- **RF021** — Solicitante edita em ajuste.
- **RF022** — Job 7 dias → cancelamento (*necessita validação*).

### Atendimento

- **RF023** — Fila atendimento (`/service`).
- **RF024** — Iniciar atendimento + notificação.
- **RF025** — CRUD tarefas no ticket.
- **RF026** — CRUD apontamentos manuais.
- **RF027** — Calcular `totalMinutes` de início/fim.
- **RF028** — Validar fim > início.
- **RF029** — Alterar prioridade com auditoria.
- **RF030** — Comentários internos/externos.
- **RF031** — Concluir → `awaiting_evaluation`.

### Cancelamento Zeev

- **RF032** — Repeater N solicitações (número + justificativa).
- **RF033** — Aprovação por responsável configurado.
- **RF034** — Bypass "aprovar direto" com permissão.
- **RF035** — Registrar resultado por item.

### Avaliação

- **RF036** — Solicitante avalia pós-resolução.
- **RF037** — Expectativa atendida, nota 1–10, feedback.
- **RF038** — Justificativa NPS se nota ≤ limiar (default 6).
- **RF039** — "Qual era a expectativa" se não atendeu.
- **RF040** — Persistir avaliação → `completed`.

### Notificações

- **RF041** — Discord por prioridade (engine existente).
- **RF042** — E-mail transacional por evento.
- **RF043** — Templates configuráveis.
- **RF044** — Log de notificações.

### Administração

- **RF045** — CRUD usuários + permissions.
- **RF046** — CRUD centros de custo, enums configuráveis.
- **RF047** — Responsáveis padrão triagem/cancelamento.
- **RF048** — Regras condicionais formulário.
- **RF049** — Workflows por tipo.
- **RF050** — Auditoria e logs.

### Relatórios

- **RF051** — Dashboard KPIs.
- **RF052** — Export CSV.
- **RF053** — Tempo médio triagem/atendimento.
- **RF054** — Tempo apontado por responsável.
- **RF055** — Motivos avaliação baixa.

### Integridade

- **RF056** — AuditLog append-only.
- **RF057** — Transições inválidas bloqueadas.
- **RF058** — RBAC por etapa.
- **RF059** — Rascunho de ticket (*sugestão*).
- **RF060** — Webhook Zeev descontinuado.

## Critérios de Aceite — Fase B (Abertura)

- [ ] CA-B01: Formulário exibe campos condicionais por tipo.
- [ ] CA-B02: Melhoria exige checkbox ciência.
- [ ] CA-B03: Interrupção exige serviço + sistema/infra conforme seleção.
- [ ] CA-B04: Ticket recebe `ticketNumber` único.
- [ ] CA-B05: Centro de custo vem de lista CRUD.

## Critérios de Aceite — Fase C (Aprovações + Triagem)

- [ ] CA-C01: Melhoria roteia para Gestor TI após criação.
- [ ] CA-C02: Gestor TI aprova → Gestor App.
- [ ] CA-C03: Gestor App aprova → triagem.
- [ ] CA-C04: Recusa encerra com status terminal + e-mail.
- [ ] CA-C05: Fila triagem lista tickets `in_triage`.
- [ ] CA-C06: Triagem atribui atendente e avança para fila.

## Critérios de Aceite — Fase D (Atendimento)

- [ ] CA-D01: Atendente vê tickets atribuídos.
- [ ] CA-D02: CRUD tarefas funcional.
- [ ] CA-D03: Apontamento manual calcula minutos.
- [ ] CA-D04: Conclusão move para avaliação pendente.

## Critérios de Aceite — Fase E (Cancelamento)

- [ ] CA-E01: Tipo cancelamento aceita N itens.
- [ ] CA-E02: Fluxo aprovação/direto funciona.
- [ ] CA-E03: Recusa notifica solicitante.

## Critérios de Aceite — Fase F (Avaliação + Relatórios)

- [ ] CA-F01: Avaliação 1–10 com regras NPS.
- [ ] CA-F02: Dashboard exibe KPIs básicos.
- [ ] CA-F03: E-mails disparados nos eventos principais.

## Dependências

- Requer: Fases 1–8 existentes (auth, tickets, SLA, workflow, timers, Discord).
- Afeta: `shared/types`, `electron/services`, `electron/ipc`, `src/pages`, `src/router.tsx`.
- Supersede: webhook Zeev em `specs/tickets-phase2/spec.md`.

## Notas de implementação

- Workflow default Zeev: seed via `electron/services/zeev-workflow-seed.ts`.
- Form rules: `shared/lib/form-rules.ts` + `electron/services/form-rules.ts`.
- Permissões: array `permissions[]` no User; helper `hasPermission(user, key)`.
