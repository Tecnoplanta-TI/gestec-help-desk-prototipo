# Migração Zeev → gestec · help desk

**Status:** draft  
**Data:** 2026-06-17  
**Escopo:** Substituição 100% do fluxo Zeev no aplicativo Electron existente

## Decisões de escopo

| Decisão | Valor |
|---------|-------|
| Arquitetura alvo | Electron único — todos os perfis na mesma aplicação |
| Papel do Zeev | Substituído integralmente |
| Stack | Electron + React + Vite + Cosmos DB + Blob Storage |
| Abordagem | Spec Driven Development (SDD) |

## Índice de documentos

| Documento | Conteúdo |
|-----------|----------|
| [spec.md](./spec.md) | RF001–RF060, critérios de aceite, dependências |
| [gap-analysis.md](./gap-analysis.md) | Estado atual vs paridade Zeev |
| [data-model.md](./data-model.md) | Entidades, campos, containers Cosmos |
| [workflow.md](./workflow.md) | Estados, transições, BPMN |
| [form-fields.md](./form-fields.md) | Campos, matriz condicional, validações |
| [use-cases.md](./use-cases.md) | 20 casos de uso detalhados |
| [user-stories.md](./user-stories.md) | Histórias com Given/When/Then |
| [notifications.md](./notifications.md) | Eventos, canais, templates |
| [screens-ux.md](./screens-ux.md) | Telas por perfil, melhorias UX |
| [requirements-non-functional.md](./requirements-non-functional.md) | RNF001–RNF030 |
| [implementation-phases.md](./implementation-phases.md) | Fases A–G |
| [validation-points.md](./validation-points.md) | Pontos a validar com equipe |
| [decisions.md](./decisions.md) | Decisões de design |
| [report.md](./report.md) | Revisão arquitetural |

## Spec Driven Development (SDD)

**Spec Driven Development** coloca a especificação como artefato central que governa implementação, testes e validação. Neste repositório o padrão está em `specs/*/spec.md` com `decisions.md` e `report.md`.

### Por que SDD na migração Zeev

- Fluxo com 5 tipos de solicitação, campos condicionais e 3 níveis de aprovação
- 22+ estados de ticket com regras de transição distintas
- 7 perfis de usuário com permissões por etapa
- Notificações Discord + e-mail por evento

### Transformação de artefatos

| Origem Zeev | Artefato SDD |
|-------------|--------------|
| Prints de formulário | [form-fields.md](./form-fields.md) |
| Dropdowns | Enums em `shared/types` |
| BPMN | [workflow.md](./workflow.md) |
| Aprovações | [use-cases.md](./use-cases.md) |
| Avaliação NPS | [data-model.md](./data-model.md) |

### Legenda de origem

| Tag | Significado |
|-----|-------------|
| **identificado nas prints** | Visível nos anexos Zeev |
| **inferido** | Deduzido do BPMN |
| **sugestão** | Melhoria proposta |
| **necessita validação** | Confirmar com equipe |

## Perfis de usuário

| Perfil | Permission key | Responsabilidade |
|--------|----------------|------------------|
| Solicitante | `requester` | Abrir, acompanhar, ajustar, avaliar |
| Gestor TI | `it_manager` | Aprovar melhorias (1ª instância) |
| Gestor App | `app_manager` | Aprovar melhorias (2ª instância) |
| Triagem | `triage` | Triar, atribuir atendente |
| Atendente | `agent` | Atender, tarefas, apontamentos |
| Resp. cancelamentos | `cancellation_approver` | Aprovar cancelamentos Zeev |
| Admin | `admin` | Configuração completa |

## Supersede

Substitui parcialmente `specs/tickets-phase2/spec.md` (webhook) e integração outbound planejada no roadmap.
