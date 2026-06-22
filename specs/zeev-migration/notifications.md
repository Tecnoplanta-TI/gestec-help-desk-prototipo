# Notificações — Migração Zeev

**Data:** 2026-06-17

## Canais

| Canal | Implementação |
|-------|---------------|
| Discord | `electron/services/discord.ts` (existente) |
| E-mail | `electron/services/email.ts` (novo) |
| In-app | Toast + badge contadores nas filas (*sugestão*) |

## Catálogo de eventos

| ID | Evento disparador | Destinatário | Canal | Obrigatória | Momento |
|----|-------------------|--------------|-------|-------------|---------|
| N01 | Ticket criado | Triagem / geral | Discord | Opcional | Após `createTicket` |
| N02 | Prioridade P1 | Canal P1 | Discord | Config | Abertura |
| N03 | Prioridade P2 | Canal P2 | Discord | Config | Abertura |
| N04 | Prioridade P3 | Canal P3 | Discord | Config | Abertura |
| N05 | Prioridade P4 | Canal P4 | Discord | Config | Abertura |
| N06 | Melhoria aguardando TI | Gestores TI | E-mail | Sim | → `awaiting_it_manager_approval` |
| N07 | Melhoria recusada TI | Solicitante | E-mail | Sim | → `improvement_rejected_by_it` |
| N08 | Melhoria aguardando App | Gestor app | E-mail | Sim | → `awaiting_app_manager_approval` |
| N09 | Melhoria recusada App | Solicitante | E-mail | Sim | → `improvement_rejected_by_app` |
| N10 | Melhoria aprovada | Solicitante + triagem | E-mail | Sim | → `in_triage` |
| N11 | Ticket em triagem | Triadores | In-app | Sim | → `in_triage` |
| N12 | Recusado triagem | Solicitante | E-mail | Sim | → `triage_rejected` |
| N13 | Aguardando ajuste | Solicitante | E-mail | Sim | → `awaiting_requester_adjustment` |
| N14 | Ajuste 7 dias | Solicitante | E-mail | Se regra | Job timeout |
| N15 | Atendimento iniciado | Solicitante | E-mail | Sim | → `in_service` |
| N16 | Ticket concluído | Solicitante | E-mail | Sim | → `completed` |
| N17 | Cancelamento aprovado | Solicitante | E-mail | Sim | → `cancellation_completed` |
| N18 | Cancelamento recusado | Solicitante | E-mail | Sim | → `cancellation_rejected` |
| N19 | Avaliação pendente | Solicitante | E-mail | Sim | → `awaiting_evaluation` |
| N20 | Avaliação recebida | Gestão TI | In-app | Opcional | → `completed` |

## Templates e-mail (placeholders)

```
Assunto: [Gestec] {event_label} — Ticket {ticket.ticketNumber}

Olá {recipient.name},

{body}

Ticket: {ticket.ticketNumber}
Tipo: {ticket.type}
Prioridade: {ticket.priority}
Link: gestec://tickets/{ticket.id}

---
gestec · help desk
```

## Templates Discord (reutilizar engine)

Condição por prioridade:
```json
{ "field": "priority", "operator": "equal", "value": "P1" }
```

Template exemplo P1:
```
🚨 **P1** — Ticket {ticket.ticketNumber}
{ticket.title}
Solicitante: {requester.name} | CC: {requester.costCenter}
```

## NotificationLog

Persistir cada envio: `event`, `channel`, `recipient`, `success`, `error?`, `sentAt`, `ticketId`.

## Configuração admin

- `/settings/email` — SMTP, from, templates por evento
- `/settings/discord` — regras existentes + presets P1–P4

## Falha de envio

E-mail/Discord falhou → log + não bloqueia transição de ticket (RNF Discord existente).
