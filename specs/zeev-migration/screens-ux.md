# Telas e UX — Migração Zeev

**Data:** 2026-06-17

## Melhorias UX vs Zeev

| Melhoria | Descrição | Origem |
|----------|-----------|--------|
| Wizard multi-etapa | Tipo → Classificação → Detalhes → Anexos → Revisão | sugestão |
| Cards tipo solicitação | Seleção visual em vez de dropdown longo | sugestão |
| Tooltip prioridade | Critérios P1–P4 on-demand | sugestão |
| Timeline ticket | Histórico visual unificado | sugestão |
| Drag-drop anexos | Upload moderno | sugestão |
| Modal novo ticket | Fundo blur (já iniciado) | sugestão |
| Avaliação botões 1–10 | Escala tátil | identificado |
| SLA countdown | Badge nas filas | sugestão |
| Abertura rápida | Modo simplificado incidente/solicitação | sugestão |

---

## Solicitante

### Login (`/login`)
- **Objetivo:** Autenticar
- **Componentes:** Form e-mail/senha
- **Permissões:** Público

### Dashboard (`/` ou `/home`)
- **Objetivo:** Visão geral tickets do usuário
- **Componentes:** Stats cards, tickets recentes, atalho novo ticket
- **Ações:** Novo ticket, ver meus tickets

### Nova solicitação (`/tickets/new` ou modal)
- **Objetivo:** Abrir ticket com campos condicionais
- **Componentes:** `DynamicTicketForm`, `PriorityCriteriaHelp`, `AttachmentDropzone`
- **Campos:** [form-fields.md](./form-fields.md)
- **Validações:** Zod por tipo
- **Estados:** draft loading, validation errors, success redirect

### Meus tickets (`/tickets/mine`)
- **Objetivo:** Listar tickets do solicitante
- **Filtros:** status, tipo, data
- **Colunas:** número, título, tipo, status, prioridade, SLA

### Detalhe (`/tickets/:id`)
- **Objetivo:** Acompanhar andamento
- **Componentes:** Info cards, Timeline, comentários públicos, anexos
- **Ações:** Ajustar (se permitido), avaliar (se pendente)

### Ajustar solicitação
- **Objetivo:** Editar campos após pedido de ajuste
- **Campos editáveis:** descrição, anexos, campos condicionais não bloqueados

### Avaliar (`/tickets/:id/evaluate`)
- **Objetivo:** NPS pós-atendimento
- **Componentes:** Radio expectativa, botões 1–10, textareas condicionais

---

## Gestor TI (`/approvals/it`)

- **Objetivo:** Fila melhorias 1ª instância
- **Componentes:** `ApprovalQueue`, `ApprovalDetailPanel`
- **Ações:** Aprovar, Recusar, Solicitar ajuste
- **Permissões:** `it_manager`

## Gestor App (`/approvals/app`)

- Idem Gestor TI para 2ª instância.
- **Permissões:** `app_manager`

---

## Triagem (`/triage`)

- **Objetivo:** Fila tickets em triagem
- **Componentes:** Tabela/kanban, `AssigneeSelect`, decisão triagem
- **Ações:** Aprovar+atribuir, Recusar, Ajuste
- **Permissões:** `triage`

---

## Atendimento (`/service`)

- **Objetivo:** Fila tickets atribuídos
- **Componentes:** Lista, link detalhe, timer widget
- **Permissões:** `agent` (próprios tickets)

## Detalhe atendimento (`/tickets/:id`)

- **Seções:** Dados, Tarefas, Apontamentos, Comentários (int/ext), Timer
- **Ações:** Iniciar, Concluir, alterar prioridade, CRUD tarefas/apontamentos

---

## Administração

| Rota | Objetivo |
|------|----------|
| `/settings/users` | Usuários + permissions |
| `/settings/cost-centers` | Centros de custo |
| `/settings/workflows` | Fluxos (existente) |
| `/settings/sla` | SLA (existente) |
| `/settings/discord` | Discord (existente) |
| `/settings/email` | Templates e SMTP |
| `/settings/app-config` | Limiar NPS, timeout ajuste |
| `/reports/dashboard` | KPIs operacionais |

---

## Navegação (RootLayout)

Adicionar itens condicionais por permissão:
- Início, Tickets, Meus tickets
- Aprovações (TI/App)
- Triagem, Atendimento
- Projetos, Relatórios, Configurações

## Responsividade

Min-width 1024px; formulário wizard colapsa em coluna única abaixo de 1280px.

## Acessibilidade

Labels em todos inputs; asterisco vermelho para obrigatórios; mensagens de erro associadas via `aria-describedby`.
