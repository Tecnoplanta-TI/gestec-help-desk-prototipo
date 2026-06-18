# Proposta de Desenvolvimento — gestec · help desk

## Contexto

A Tecnoplanta utiliza uma plataforma externa de processos (atualmente Zeev, possivelmente substituída no futuro) para abertura e acompanhamento de tickets de TI. O time de TI precisa cronometrar o atendimento e gerar faturas de horas técnicas por centro de custo, mas a plataforma atual não possui esse recurso. O objetivo é consolidar triagem, cronometragem, gestão de fluxos, projetos internos e relatórios em uma única aplicação Electron para Windows, mantendo a plataforma externa apenas para abertura de tickets pelo solicitante e coleta de NPS. O time de TI também poderá abrir tickets diretamente na aplicação.

---

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────┐
│                  Electron (Windows)                  │
│  ┌──────────────────┐   ┌────────────────────────┐  │
│  │  Main Process    │   │  Renderer Process      │  │
│  │  (Node.js)       │   │  (React + Vite)        │  │
│  │  - IPC handlers  │   │  - UI / páginas        │  │
│  │  - API REST      │   │  - Estado global       │  │
│  │  - Notificações  │   │  - Cronômetros         │  │
│  │  - Janela float  │   │  - Relatórios PDF      │  │
│  └──────────────────┘   └────────────────────────┘  │
│             │                      │                  │
│             └──────── IPC ─────────┘                  │
└─────────────────────────────────────────────────────┘
           │                          │
    Azure Cosmos DB              Azure Blob Storage
    (dados da aplicação)         (anexos / notas fiscais)
```

### Comunicação com Plataforma Externa de Processos
- **Entrada:** Webhook da plataforma → `POST /webhooks/ticket` (API Fastify interna) → cria ticket no Cosmos DB
- **Saída:** API interna chama endpoint da plataforma para atualizar status/conclusão do ticket
- **Abertura manual:** Time de TI pode criar tickets diretamente na aplicação (formulário completo interno)
- **Abstração:** Serviço `platform-integration.ts` encapsula toda comunicação externa, facilitando futura troca de plataforma

---

## Stack Tecnológico

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Shell desktop | **Electron 33+** | Multi-window, notificações nativas, tray, always-on-top |
| Build Renderer | **Vite 6 + React 19** | Fast HMR, tree-shaking, compatível com Electron |
| Linguagem | **TypeScript 5** | Tipagem end-to-end |
| UI | **shadcn/ui** (tema Luma) + **Tailwind CSS 4** | Componentes acessíveis, customizáveis, estáveis |
| Font | **Geist** (Vercel) | Leitura técnica, moderna |
| Cores | Branco · Verde Tecnoplanta · Preto | Identidade da empresa |
| Estado global | **Zustand 5** | Leve, adequado a cronômetros em tempo real |
| Formulários | **React Hook Form 7 + Zod 4** | Validação robusta |
| Banco de dados | **Azure Cosmos DB (NoSQL)** | Documentos flexíveis, escalável |
| Arquivos | **Azure Blob Storage** | Notas fiscais, relatórios, anexos |
| SDK Azure | **@azure/cosmos + @azure/storage-blob** | SDKs oficiais maduros |
| PDF | **@react-pdf/renderer** | Documentos PDF tipados em React |
| Kanban | **@dnd-kit** | Drag-and-drop acessível |
| Gráficos | **Recharts** | Já familiar no ecossistema gestec |
| Datas | **date-fns** | Leve, tree-shakeable |
| HTTP interno | **Fastify** (no Main Process) | API REST interna + webhooks plataforma externa |
| Autenticação | **bcrypt + JWT (jose)** | Seguro, sem dependência de servidor externo |
| Spec/IA | **Skills Claude Code customizadas** | Geração e manutenção de Specs padronizadas |

---

## Estrutura de Pastas

```
gestec-help-desk/
├── electron/                        # Main Process
│   ├── main.ts                      # Entry point Electron
│   ├── preload.ts                   # Context bridge (IPC seguro)
│   ├── api/                         # Servidor Fastify interno
│   │   ├── server.ts
│   │   ├── routes/
│   │   │   ├── tickets.ts
│   │   │   ├── projects.ts
│   │   │   ├── timers.ts
│   │   │   ├── reports.ts
│   │   │   ├── notifications.ts
│   │   │   └── webhooks.ts          # Recebe tickets da plataforma externa
│   │   └── middleware/
│   │       ├── auth.ts
│   │       └── rateLimit.ts
│   ├── windows/
│   │   ├── main-window.ts
│   │   └── floating-timer.ts        # Janela flutuante always-on-top
│   ├── services/
│   │   ├── cosmos.ts                # Cosmos DB client
│   │   ├── blob.ts                  # Azure Blob client
│   │   ├── platform-integration.ts  # Abstração da plataforma externa (atualmente Zeev)
│   │   ├── discord.ts               # Notificações Discord (templates configuráveis)
│   │   └── notification.ts          # Notificações nativas Windows
│   └── ipc/                         # IPC handlers tipados
│       ├── timer-ipc.ts
│       └── auth-ipc.ts
├── src/                             # Renderer Process
│   ├── main.tsx
│   ├── App.tsx
│   ├── router.tsx                   # React Router 7
│   ├── pages/
│   │   ├── auth/
│   │   │   └── LoginPage.tsx
│   │   ├── tickets/
│   │   │   ├── TicketListPage.tsx
│   │   │   ├── TicketKanbanPage.tsx
│   │   │   └── TicketDetailPage.tsx
│   │   ├── projects/
│   │   │   ├── ProjectListPage.tsx
│   │   │   └── ProjectDetailPage.tsx
│   │   ├── reports/
│   │   │   └── BillingReportPage.tsx
│   │   ├── settings/
│   │   │   ├── WorkflowsPage.tsx
│   │   │   ├── UsersPage.tsx
│   │   │   ├── RatesPage.tsx
│   │   │   ├── SlaPage.tsx
│   │   │   └── DiscordNotificationsPage.tsx
│   │   └── FloatingTimer.tsx        # Janela flutuante (renderer)
│   ├── components/
│   │   ├── ui/                      # shadcn/ui (gerado)
│   │   ├── tickets/
│   │   │   ├── SlaIndicator.tsx     # Badge/badge visual de SLA
│   │   │   └── TicketForm.tsx       # Formulário manual de abertura
│   │   ├── timers/
│   │   ├── kanban/
│   │   ├── reports/
│   │   └── layout/
│   ├── stores/                      # Zustand stores
│   │   ├── authStore.ts
│   │   ├── timerStore.ts            # Múltiplos cronômetros simultâneos
│   │   └── ticketStore.ts
│   ├── hooks/
│   ├── lib/
│   │   ├── ipc.ts                   # Wrapper tipado window.electronAPI
│   │   ├── pdf.ts                   # Templates PDF fatura
│   │   └── sla.ts                   # Cálculos de SLA e status
│   └── types/
│       └── index.ts
├── specs/                           # Specs de desenvolvimento (Claude)
│   ├── _template.md
│   ├── index.md                     # Índice de todas as specs
│   └── [feature]/
│       ├── spec.md
│       ├── decisions.md
│       └── report.md
├── .claude/
│   └── skills/
│       ├── spec-creator.md          # Skill: coletar requisitos e criar spec
│       └── arch-review.md           # Skill: validar spec contra arquitetura
├── electron-builder.config.ts
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Módulos da Aplicação

### 1. Autenticação & Usuários
- Login com e-mail e senha (bcrypt + JWT armazenado em `electron-store`)
- **Criação de contas exclusiva pelo administrador** (e-mail + senha inicial)
- Grupos: **membro**, **gestor**, **administrador**
- Permissões granulares por recurso e ação
- Primeiro acesso: seed do primeiro admin via CLI (`npm run seed:admin`)

### 2. Tickets

#### 2a. Campos do Formulário de Abertura (solicitante / TI manual)
| Campo | Tipo | Observação |
|-------|------|-----------|
| Centro de custo | Select | Lista de CCs cadastrados |
| Tipo de solicitação | Select | Incidente · Interrupção de serviço · Melhoria · Solicitação |
| Prioridade | Select | P1 · P2 · P3 · P4 |
| Grupo de serviços | Select | Acessos/contas · Aquisições/alocações · Dashboards · Emails · Gestec · Impressoras · Manutenção/upgrade · Programas · Rede/internet · ERP · Plataforma de processos · Outro |
| Descrição da solicitação | Textarea | |

#### 2b. Campos Internos do TI (preenchidos durante/após atendimento)
| Campo | Tipo | Observação |
|-------|------|-----------|
| Nível | Select | N1 · N2 · N3 |
| Código patrimonial | Text | |
| Código lacre de segurança | Text | |
| Novo código de lacre de segurança | Text | |
| Considerações do suporte | Textarea | |
| Tempo de indisponibilidade | Number | Em minutos |

#### 2c. Registros de Apontamento (múltiplos por ticket)

Cada ticket possui uma **lista de registros de apontamento**, pois um ticket pode levar vários dias e sessões de trabalho para ser finalizado.

**Origem dos registros:**
- **Automática:** ao parar ou pausar o cronômetro, um registro é criado automaticamente com data, hora início, hora fim e total calculado (em minutos)
- **Manual:** o técnico pode adicionar registros manualmente (ex.: atendimento realizado sem o cronômetro, retrabalho registrado depois)

**Campos de cada registro:**
| Campo | Tipo | Observação |
|-------|------|-----------|
| Data | Date | Preenchida automaticamente ou pelo técnico |
| Hora início | Time | Preenchida automaticamente ou pelo técnico |
| Hora fim | Time | Preenchida automaticamente ou pelo técnico |
| Tempo total | Number (auto) | Calculado a partir de início/fim; editável no lançamento manual |
| Técnico | Ref User | Quem realizou o atendimento |
| Origem | Enum | `"timer"` ou `"manual"` |
| Observação | Text opcional | Descrição do que foi feito nessa sessão |

**Regras:**
- O **tempo total do ticket** é a soma de todos os registros de apontamento
- Registros de origem `"timer"` são criados automaticamente e podem ser editados pelo técnico após o fato
- Registros de origem `"manual"` são criados via formulário na tela do ticket
- A tela de detalhe exibe a lista de registros em ordem cronológica com total acumulado

#### 2d. Campos de Avaliação do Atendimento (NPS — retornam da plataforma externa)
| Campo | Tipo | Observação |
|-------|------|-----------|
| Solicitação atendida conforme expectativa? | Radio | Sim · Não |
| Nota do serviço prestado | Slider/Select | 1 a 10 |
| Qual era a expectativa? | Textarea | Aparece apenas se expectativa = Não |
| Feedback | Textarea | |
| Justificativa NPS | Textarea | Aparece apenas se nota ≤ 6 |

#### 2e. Comportamentos
- Visualização lista e Kanban (colunas = etapas do fluxo de trabalho ativo)
- Filtros: prioridade, responsável, status, SLA, período, grupo de serviços, CC
- **Indicator visual de SLA** no card/linha do ticket: dentro (verde) · próximo — ≤ 20% do prazo restante (amarelo) · fora (vermelho)
- Abertura manual pelo TI via formulário completo interno (sem dependência da plataforma externa)
- Integração via webhook de entrada e saída com a plataforma externa

### 3. Fluxos de Trabalho (Workflow Engine)
- Editor visual de fluxo (etapas + transições + condições)
- Etapas configuráveis: nome, responsável padrão, tipo (automática / manual / aprovação)
- **SLA por etapa:** configurável e opcional — define prazo máximo em horas por etapa
- Condições de roteamento baseadas em campos do ticket (ex.: tipo = Melhoria → etapa de aprovação do gestor)
- Suporte a aprovação do gestor antes da triagem (tickets de melhoria)
- Persistido como documento JSON no Cosmos DB

### 4. SLA
- Cadastro de regras de SLA: nome, prioridade ou grupo de serviços, prazo em horas
- SLA por etapa do fluxo (opcional por etapa)
- Cálculo automático de `deadline` ao criar/mover ticket
- Funções em `src/lib/sla.ts`: `calcDeadline()`, `getSlaStatus()` → `"ok" | "warning" | "overdue"`
- Componente `SlaIndicator` exibido em lista, Kanban e detalhe do ticket

### 5. Notificações Discord (configuráveis)
- Cadastro de regras de notificação: nome, condição de disparo, template de mensagem
- **Condição:** campo do ticket + operador + valor (ex.: `costCenter = "45"`, `priority = "P1"`)
- **Template de mensagem com variáveis interpoladas:**
  ```
  Ticket da direção aberto por {requester.name} em {ticket.date} {ticket.time}
  Prioridade: {ticket.priority} | Grupo: {ticket.serviceGroup}
  ```
- Variáveis disponíveis: `ticket.*`, `requester.*`, `assignee.*`
- Múltiplos webhooks Discord configuráveis (canais diferentes por tipo de notificação)
- Disparo: via serviço `discord.ts` no Main Process, avaliando regras a cada mudança de estado do ticket

### 6. Cronômetros
- Múltiplos cronômetros simultâneos (por ticket ou tarefa de projeto)
- Estados: em andamento, pausado, finalizado
- Persistência no Cosmos DB (sobrevive a restart da aplicação)
- Janela flutuante always-on-top: lista dos cronômetros ativos com play/pause/stop + botão pin/unpin
- **Ao parar o cronômetro:** cria automaticamente um registro de apontamento no ticket com `origin: "timer"`, data/hora início/fim e total calculado
- O técnico pode editar o registro gerado após o fato (corrigir horários, adicionar observação)
- Lançamentos manuais disponíveis na tela do ticket via botão "Adicionar apontamento" (formulário simples com os mesmos campos)

### 7. Projetos & Tarefas
- Projetos internos com tarefas filhas
- Mesmo sistema de cronômetro dos tickets
- Associação a centro de custo
- Valor da hora configurável por projeto/tipo

### 8. Despesas
- Registro por ticket ou projeto: descrição, fornecedor, quantidade, valor unitário, total
- Upload de nota fiscal (PDF/imagem) para Azure Blob
- Visualização e edição na tela de detalhe

### 9. Relatório de Faturamento (PDF)
- Template tipo fatura: logotipo, período, centro de custo/projeto
- Tabela de tickets: ID, título, descrição, horas, valor hora, subtotal
- Tabela de despesas: descrição, fornecedor, valor
- Total geral
- Filtros: período, centro de custo, projeto, grupo de serviços, responsável
- Gerado com `@react-pdf/renderer` e salvo no Blob / download local

---

## Modelos de Dados (Cosmos DB)

### Containers

```typescript
// Ticket
{
  id: string,
  externalId?: string,       // ID na plataforma externa (se veio por webhook)
  source: "external"|"manual",
  title: string,
  description: string,
  requester: { name, email, costCenter },
  type: "incident"|"service_interruption"|"improvement"|"request",
  priority: "P1"|"P2"|"P3"|"P4",
  serviceGroup: string,
  status: string,            // etapa atual do fluxo
  workflowId: string,
  assigneeId: string,
  // Campos internos TI
  level?: "N1"|"N2"|"N3",
  assetCode?: string,
  securitySealCode?: string,
  newSecuritySealCode?: string,
  supportNotes?: string,
  downtimeMinutes?: number,
  // Registros de apontamento (múltiplos — automáticos do cronômetro ou manuais)
  appointments: Appointment[], // { id, date, startTime, endTime, totalMinutes, technicianId, origin: "timer"|"manual", note? }
  // timeLogs são os snapshots brutos do cronômetro (estado intermediário, pausas, retomadas)
  timeLogs: TimeLog[],
  expenses: Expense[],
  // SLA
  sla: { deadline?, firstContactAt?, resolvedAt?, status: "ok"|"warning"|"overdue" },
  // Avaliação NPS (preenchida pela plataforma externa)
  evaluation?: {
    metExpectation: boolean,
    score: number,            // 1-10
    expectation?: string,
    feedback?: string,
    npsJustification?: string
  },
  createdAt, updatedAt
}

// Project
{
  id, name, description,
  costCenter, hourlyRate,
  tasks: Task[],
  timeLogs: TimeLog[],
  expenses: Expense[],
  createdAt, updatedAt
}

// Workflow
{
  id, name, description, isDefault: boolean,
  steps: WorkflowStep[],     // { id, name, type, assigneeId?, slaHours? }
  transitions: Transition[]  // { from, to, conditions: Condition[] }
}

// User
{
  id, name, email,
  passwordHash, role: "member"|"manager"|"admin",
  permissions: string[],
  createdAt, updatedAt
}

// HourlyRate
{
  id, name, type: "ticket"|"project",
  serviceGroup?, projectId?,
  ratePerHour: number,
  currency: "BRL"
}

// SlaRule
{
  id, name,
  priority?: "P1"|"P2"|"P3"|"P4",
  serviceGroup?: string,
  deadlineHours: number      // prazo total do ticket
}

// DiscordNotificationRule
{
  id, name, webhookUrl,
  conditions: [{ field, operator, value }],
  messageTemplate: string    // com placeholders {ticket.priority}, etc.
  triggerOn: "created"|"status_changed"|"assigned"|...
}

// CostCenter
{
  id, code, name, active: boolean
}
```

---

## Skills Claude Code

### Skill: `spec-creator`
**Objetivo:** Conduzir entrevista com o desenvolvedor, coletar todos os requisitos de uma feature e gerar um documento Spec padronizado em `specs/[feature]/spec.md`.

**Fluxo:**
1. Perguntar: nome da feature, problema que resolve, usuários impactados
2. Perguntar: casos de uso principais, edge cases, restrições
3. Perguntar: impacto em outros módulos, integrações externas
4. Perguntar: critérios de aceite e como testar
5. Gerar `spec.md` com seções: Contexto · Requisitos Funcionais · Requisitos Não-funcionais · Casos de Uso · Modelo de Dados afetado · Critérios de Aceite · Dependências
6. Criar/atualizar entrada em `specs/index.md`
7. Salvar `decisions.md` com as decisões de design tomadas

### Skill: `arch-review`
**Objetivo:** Antes de iniciar o desenvolvimento de uma Spec, validar se a proposta respeita a arquitetura definida e identificar riscos.

**Fluxo:**
1. Ler a Spec alvo
2. Ler arquivos de arquitetura base (`electron/`, `src/`, estrutura de pastas)
3. Verificar: camada correta (Main vs Renderer), uso de IPC seguro, particionamento Cosmos DB, segurança (sem secrets no Renderer), impacto em outras specs
4. Gerar `specs/[feature]/report.md`: ✅ Aprovado / ⚠️ Ajuste necessário / ❌ Bloqueado + justificativas
5. Sugerir ajustes antes de permitir início do desenvolvimento

---

## Roadmap de Desenvolvimento (Fases)

### Fase 0 — Fundação
- [ ] **Criar repositório privado no GitHub** (`tecnoplanta/gestec-help-desk`), com branch `main` protegida
- [ ] Configurar `.gitignore` (node_modules, dist, .env, electron-store, *.log)
- [ ] Criar Skills `spec-creator` e `arch-review`
- [ ] Configurar projeto Electron + Vite + React + TypeScript
- [ ] Configurar shadcn/ui (tema Luma, Geist, cores branco/verde/preto)
- [ ] Conectar Azure Cosmos DB e Blob Storage
- [ ] Servidor Fastify interno (Main Process)
- [ ] Context Bridge IPC tipado

### Fase 1 — Autenticação & Usuários
- [ ] Spec → review → Login, sessão JWT
- [ ] Criação de contas pelo admin, grupos e permissões

### Fase 2 — Tickets (abertura manual + webhook)
- [ ] Spec → review → Webhook de entrada (plataforma externa) + serviço de abstração
- [ ] Spec → review → Formulário manual de abertura de ticket
- [ ] Spec → review → Visualização lista, Kanban, detalhe

### Fase 3 — SLA
- [ ] Spec → review → Cadastro de regras de SLA
- [ ] Cálculo automático, `SlaIndicator` visual

### Fase 4 — Fluxos de Trabalho
- [ ] Spec → review → Editor de workflows (etapas, transições, condições, SLA por etapa)
- [ ] Motor de transições e aprovações

### Fase 5 — Cronômetros
- [ ] Spec → review → Cronômetro por ticket/tarefa, múltiplos simultâneos
- [ ] Janela flutuante always-on-top

### Fase 6 — Notificações Discord
- [ ] Spec → review → Cadastro de regras e templates personalizáveis
- [ ] Motor de avaliação de condições + disparo de webhooks

### Fase 7 — Projetos & Tarefas
- [ ] Spec → review → Projetos internos, tarefas, valores de hora

### Fase 8 — Despesas & Anexos
- [ ] Spec → review → Registro de despesas, upload Azure Blob

### Fase 9 — Relatório de Faturamento
- [ ] Spec → review → Template PDF fatura, filtros, geração

### Fase 10 — Integração Saída (plataforma externa)
- [ ] Spec → review → Callback de conclusão de ticket para plataforma externa
- [ ] Sincronização de dados de NPS (avaliação)

### Fase 11 — Polimento & Qualidade
- [ ] Testes unitários e E2E
- [ ] Refinamentos de UX, performance, segurança, empacotamento Windows

---

## Controle de Versão (GitHub)

### Repositório
- **Nome:** `gestec-help-desk`
- **Organização/conta:** Tecnoplanta (privado)
- **Branch principal:** `main` (protegida — push direto bloqueado em produção futura)
- **Branch de desenvolvimento:** `develop` (trabalho diário)
- **Branches de feature:** `feature/[nome-da-fase]` por fase do roadmap

### Estratégia de Commits Automáticos
Após a conclusão de **cada tarefa** do roadmap, um commit é realizado automaticamente com mensagem padronizada seguindo **Conventional Commits**:

```
<tipo>(<escopo>): <descrição curta>

[corpo opcional com detalhes]

Co-Authored-By: Claude Sonnet <noreply@anthropic.com>
```

**Tipos usados:**
| Tipo | Quando usar |
|------|------------|
| `feat` | Nova funcionalidade implementada |
| `fix` | Correção de bug |
| `refactor` | Refatoração sem mudança de comportamento |
| `docs` | Alteração em specs, documentação, README |
| `chore` | Configurações, dependências, tooling |
| `test` | Adição ou correção de testes |

**Exemplos de mensagens:**
```
feat(auth): implement JWT login with bcrypt password hashing
feat(tickets): add manual ticket creation form with all IT fields
feat(timers): auto-generate appointment record on timer stop
chore(setup): initialize Electron + Vite + React + TypeScript project
docs(specs): add spec for workflow engine (fase 4)
```

### Arquivos nunca versionados (`.gitignore`)
- `.env` / `.env.local` — variáveis de ambiente e secrets
- `dist/` / `dist-electron/` — build gerado
- `node_modules/`
- `*.log`
- Dados locais do `electron-store` (contém tokens criptografados)

---

## Segurança
- Renderer process sem acesso direto a Node.js (`contextIsolation: true`, `nodeIntegration: false`)
- Toda comunicação Renderer ↔ Main via `contextBridge` com API IPC explícita e tipada
- Secrets (Cosmos DB, Blob, Discord webhooks) armazenados no Main Process via `electron-store` criptografado
- Rate limiting no servidor Fastify interno
- Sanitização de inputs com Zod em todas as rotas
- JWT com expiração curta + refresh token
- Webhook de entrada protegido por secret header configurável

---

## Verificação / Testes por Fase
- **Unitários:** Vitest para funções de negócio (cálculo de SLA, interpolação de templates Discord, cronômetro, PDF)
- **Integração:** Fastify `inject()` para rotas da API interna
- **E2E:** Playwright com Electron plugin para fluxos críticos (login, criar ticket manual, webhook, gerar PDF)
- **Manual:** Checklist de Spec (`critérios de aceite`) executado antes de marcar fase como concluída
