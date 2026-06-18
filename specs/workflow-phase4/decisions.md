# Decisões de Design — Workflow Engine Fase 4

| # | Decisão | Alternativa considerada | Justificativa |
|---|---------|------------------------|---------------|
| 1 | Container dedicado `workflows` com estrutura `steps/transitions` | Configuração hardcoded no frontend | Permite evolução operacional sem deploy para cada ajuste de processo |
| 2 | Motor de transição no Main (`electron/services/workflow.ts`) | Validar transição no Renderer | Segurança e consistência de regra em fonte única |
| 3 | Campo `ticket.status` guarda o `stepId` atual | Guardar nome da etapa | Evita quebra por renome de etapa e facilita lookup determinístico |
| 4 | `isDefault` único por instalação | Seleção manual de workflow em todo ticket | Simplifica operação e mantém padrão previsível |
| 5 | Permissão de CRUD restrita a `admin`; transição restrita a `manager/admin` | Permitir edição para todos | Reduz risco de alteração indevida no processo de atendimento |
| 6 | Registrar `workflowHistory` no ticket | Sem histórico (apenas estado atual) | Melhora auditabilidade e suporte a análise de gargalos |
| 7 | Recalcular SLA no avanço de etapa quando houver `slaHours` | Manter deadline original do ticket sempre | Viabiliza controle por etapa, alinhado ao plano arquitetural |