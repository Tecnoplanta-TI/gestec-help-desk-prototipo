# Casos de Uso — Migração Zeev

**Data:** 2026-06-17

---

## UC01 — Abrir ticket (genérico)

**Ator:** Solicitante  
**Objetivo:** Registrar nova solicitação.  
**Pré-condições:** Autenticado com permissão `requester`.  
**Fluxo principal:**
1. Acessa `/tickets` → "Novo ticket".
2. Preenche wizard (tipo → classificação → detalhes → anexos).
3. Sistema valida campos condicionais.
4. `createTicket` persiste ticket com `ticketNumber`.
5. Sistema roteia por tipo (melhoria/triagem/cancelamento).
6. Dispara Discord por prioridade.

**Alternativos:** Validação falha → erros inline.  
**Pós-condições:** Ticket criado; notificações enviadas.  
**Campos:** Ver [form-fields.md](./form-fields.md).  
**Notificações:** `ticket_created`, Discord P1–P4.

---

## UC02 — Abrir incidente

**Ator:** Solicitante  
**Fluxo:** UC01 com type=`incident`; opcional serviço/sistema/infra.  
**Pós:** Status → `in_triage`.

---

## UC03 — Abrir interrupção de serviço

**Ator:** Solicitante  
**Fluxo:** UC01 com type=`service_interruption`; obrigatório serviço; downtime se aplicável.  
**Pós:** `in_triage`.

---

## UC04 — Abrir melhoria

**Ator:** Solicitante  
**Fluxo:** UC01 + checkbox ciência + gestor app + aplicativo/processo.  
**Pós:** `awaiting_it_manager_approval`.  
**Notificações:** `melhoria_aguardando_ti`.

---

## UC05 — Aprovar melhoria (Gestor TI)

**Ator:** Gestor TI (`it_manager`)  
**Pré:** Ticket em `awaiting_it_manager_approval`.  
**Fluxo:**
1. Acessa `/approvals/it`.
2. Revisa detalhes e anexos.
3. Clica Aprovar → `approveTicket({ approved: true })`.
4. Status → `awaiting_app_manager_approval`.

**Alternativo — Recusar:** Justificativa obrigatória → `improvement_rejected_by_it` + e-mail.  
**Alternativo — Ajuste:** → `awaiting_requester_adjustment`.

---

## UC06 — Aprovar melhoria (Gestor App)

**Ator:** Gestor App (`app_manager`)  
**Pré:** `awaiting_app_manager_approval`.  
**Fluxo:** Similar UC05 → aprovar → `in_triage`.  
**Recusa:** → `improvement_rejected_by_app`.

---

## UC07 — Recusar melhoria

**Ator:** Gestor TI ou App  
**Fluxo:** Justificativa → status terminal recusa → e-mail solicitante.

---

## UC08 — Fazer triagem

**Ator:** Triador (`triage`)  
**Pré:** Ticket em `in_triage`.  
**Fluxo:**
1. Acessa `/triage`.
2. Analisa ticket; define/revisa prioridade se necessário.
3. Seleciona atendente.
4. Aprova → `awaiting_service`.

**Alternativos:** Recusar → `triage_rejected`. Ajuste → `awaiting_requester_adjustment`.

---

## UC09 — Recusar ticket na triagem

**Ator:** Triador  
**Fluxo:** Justificativa → `triage_rejected` + e-mail.

---

## UC10 — Solicitar ajuste da solicitação

**Ator:** Gestor TI/App ou Triador  
**Fluxo:** Comentário ao solicitante → `awaiting_requester_adjustment`; define `adjustmentDeadline` (+7d).

---

## UC11 — Ajustar solicitação

**Ator:** Solicitante  
**Pré:** `awaiting_requester_adjustment` ou `adjustment_pending`.  
**Fluxo:** Edita campos permitidos → reenvia → `in_triage` ou retorna aprovação se melhoria.

---

## UC12 — Iniciar atendimento

**Ator:** Atendente (`agent`)  
**Pré:** Ticket em `awaiting_service`, assignee = usuário.  
**Fluxo:** Iniciar → `in_service` + e-mail solicitante.

---

## UC13 — Registrar tarefas

**Ator:** Atendente  
**Fluxo:** CRUD tarefas com descrição, responsável, prazo.

---

## UC14 — Registrar apontamentos

**Ator:** Atendente  
**Fluxo:** Data, descrição, hora início/fim; sistema calcula minutos.

---

## UC15 — Concluir atendimento

**Ator:** Atendente  
**Fluxo:** Concluir → `resolved` → auto `awaiting_evaluation`.

---

## UC16 — Cancelar solicitações Zeev

**Ator:** Solicitante  
**Fluxo:** Type=cancellation; adiciona N linhas (número + justificativa); submete.

---

## UC17 — Aprovar cancelamento

**Ator:** `cancellation_approver`  
**Fluxo:** Revisa itens → aprova → `cancellation_completed`.

---

## UC18 — Recusar cancelamento

**Ator:** `cancellation_approver`  
**Fluxo:** Justificativa → `cancellation_rejected`.

---

## UC19 — Avaliar serviço

**Ator:** Solicitante  
**Pré:** `awaiting_evaluation`.  
**Fluxo:** Formulário expectativa + nota 1–10 + campos condicionais → `completed`.

---

## UC20 — Administrar configurações

**Ator:** Admin  
**Fluxo:** CRUD centros de custo, usuários/permissions, workflows, templates e-mail, app config.
