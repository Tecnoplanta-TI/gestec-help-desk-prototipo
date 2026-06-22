# Campos e Regras Condicionais — Formulário Zeev

**Data:** 2026-06-17

## Inventário completo de campos

### Seção Solicitante

| Campo | Tipo | Obrigatório | Origem |
|-------|------|-------------|--------|
| Data abertura | datetime | Auto | identificado |
| Solicitante | user | Sim | identificado |

### Seção Ticket

| Campo | Tipo | Obrigatório | Origem |
|-------|------|-------------|--------|
| Número ticket | string | Auto | identificado — validar formato |
| Centro de custo | select | Sim | identificado |
| Tipo solicitação | select | Sim | identificado |
| Serviço | select | Condicional | identificado |
| Prioridade | select P1–P4 | Sim | identificado |
| Grupo de serviços | select | Sim | identificado |
| Solicitação | textarea | Sim | identificado |
| Anexo | file[] | Não | identificado |
| Código bem/equipamento | text | Condicional | identificado |
| Aplicativo/Processo | text | Condicional | identificado |
| Tempo indisponibilidade (min) | number | Condicional | identificado |
| Considerações suporte | textarea | Condicional | identificado |
| Nível | select | Condicional | identificado — opções TBD |

### Opções identificadas

**Tipo solicitação:** Incidente, Interrupção de serviço, Melhoria, Cancelamento de solicitações Zeev, Solicitação.

**Serviço:** Infraestrutura, Sistema.

**Sistema indisponível:** 3cx, Ecommerce, Insoft, Kinghost, Outro, PDV siger, Siger.

**Infraestrutura inoperante:** Internet, Outro, Rede, Relógios ponto, Servidor local, TS, VM, VPN.

**Grupo de serviços:** Acessos/Contas, Aquisição/Alocação, Dashboard, Email, Gestec, Impressoras, Manutenção/Upgrade, Outro, Programas, Rede/Internet, SIGER.

**Prioridade P1–P4:** critérios de contato inicial documentados em spec principal.

## Matriz condicional

### 7.1 Tipo = Melhoria

**Exibir:** checkbox ciência, critérios info, aplicativo/processo, gestor app, prioridade, grupo, solicitação, anexo.

**Fluxo:** Gestor TI → Gestor App → Triagem.

### 7.2 Tipo = Incidente

**Exibir:** prioridade, critérios, grupo, solicitação, anexo, serviço (se aplicável), sistema/infra conforme serviço.

**Fluxo:** Notificar → Triagem.

### 7.3 Tipo = Interrupção de serviço

**Exibir:** serviço, prioridade, grupo, solicitação, anexo, tempo indisponibilidade, sistema/infra.

**Fluxo:** Notificar → Triagem.

### 7.4 Tipo = Cancelamento Zeev

**Exibir:** tabela cancelamentos, resp. aprovação, aprovar direto (se permissão).

**Fluxo:** Aprovação ou direto → Concluído/Recusado.

### 7.5 Tipo = Solicitação

**Exibir:** prioridade, grupo, solicitação, anexo.

### 7.6 Serviço = Sistema

**Exibir:** sistema indisponível.

### 7.7 Serviço = Infraestrutura

**Exibir:** infraestrutura inoperante.

### 7.8 Avaliação — nota baixa

**Obrigar:** justificativa NPS (score ≤ 6 configurável).

### 7.9 Avaliação — expectativa não atendida

**Obrigar:** feedback, qual era a expectativa.

## Critérios de prioridade (identificado nas prints)

### P1 — alta prioridade
Emergência; impede trabalho ou afeta operações essenciais. **Contato inicial: imediato.**

### P2 — prioridade média
Impacto significativo; resolver em horas. **Contato: 4–8 horas úteis.**

### P3 — prioridade normal
Afeta trabalho; prazo razoável. **Contato: 1–3 dias.**

### P4 — prioridade baixa
Sem impacto direto. **Contato: 3–5 dias.**

**Regra:** atendente pode ajustar prioridade com auditoria.

## Critérios melhoria (identificado)

1. Somente aplicativos já publicados.
2. Não abrir para lentidão de plataforma — serão recusados.
3. Detalhar pedido com fotos/exemplos.

## Implementação técnica

- `shared/lib/form-rules.ts` — funções puras `getVisibleFields(type, service)`, `getRequiredFields(type, service)`
- Schema Zod dinâmico em `electron/services/ticket-schema.ts`
- Componente `DynamicTicketForm` no Renderer

## Validações

| Campo | Regra |
|-------|-------|
| downtimeMinutes | integer ≥ 0 |
| Anexo | max 10MB, tipos: pdf, png, jpg, docx, xlsx |
| zeevRequestNumber | não vazio em cancelamento |
| improvementAcknowledged | true se type=improvement |
| appManagerId | required se type=improvement |
| Hora apontamento | end > start |
