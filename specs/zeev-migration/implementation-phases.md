# Fases de Implementação — Migração Zeev

**Data:** 2026-06-17

## Fase A — Spec e fundação ✅ (esta entrega)

- [x] Documentação SDD em `specs/zeev-migration/`
- [x] Revisão arquitetural ([report.md](./report.md))
- [ ] Expandir tipos e permissions
- [ ] Seed workflow Zeev default

**Entregável:** Specs aprovadas + tipos base.

---

## Fase B — MVP abertura

- Formulário dinâmico 5 tipos
- Campos condicionais (serviço, sistema, infra, melhoria)
- `ticketNumber` sequencial
- CRUD centros de custo
- Remover dependência webhook como fluxo principal

**Arquivos:** `DynamicTicketForm`, `form-rules.ts`, `cost-center` service, `TicketListPage`

**Critérios:** CA-B01 a CA-B05

---

## Fase C — Aprovações + triagem

- Estados Zeev no workflow
- Filas `/approvals/it`, `/approvals/app`, `/triage`
- `approveTicket`, `triageTicket` IPC
- Ajuste solicitante + job 7 dias (feature flag)

**Arquivos:** `approval.ts`, `ApprovalsPage`, `TriagePage`

**Critérios:** CA-C01 a CA-C06

---

## Fase D — Atendimento

- Fila `/service`
- Tarefas no ticket
- Apontamentos manuais + cálculo minutos
- Conclusão → avaliação pendente
- Comentários int/ext

**Arquivos:** `ticket.ts` extend, `TicketDetailPage` seções

**Critérios:** CA-D01 a CA-D04

---

## Fase E — Cancelamento Zeev

- Tipo `cancellation`
- Repeater itens
- Aprovação / direct approve
- Status terminais

**Critérios:** CA-E01 a CA-E03

---

## Fase F — Avaliação + relatórios

- Tela avaliação NPS
- `email.ts` + templates
- Dashboard `/reports/dashboard`
- KPIs básicos

**Critérios:** CA-F01 a CA-F03

---

## Fase G — Admin e polish

- UI regras condicionais
- Auditoria timeline avançada
- Export CSV
- Paginação listagens
- Descontinuar webhook definitivamente

---

## Ordem de dependências

```
A → B → C → D → E → F → G
         ↘ E pode paralelizar após B
```

## Estimativa relativa

| Fase | Complexidade |
|------|--------------|
| A | Baixa |
| B | Alta |
| C | Alta |
| D | Média |
| E | Média |
| F | Média |
| G | Baixa |
