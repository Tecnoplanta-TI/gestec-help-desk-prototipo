# Decisões de Design — SLA Fase 3

| # | Decisão | Alternativa considerada | Justificativa |
|---|---------|------------------------|---------------|
| 1 | Container dedicado `sla_rules` | Embutir regras em settings genéricas | Evolução isolada e consultas claras |
| 2 | Cálculo de SLA em função utilitária pura (`src/lib/sla.ts`) | Regras espalhadas em componentes | Testabilidade e reuso em lista/kanban/detalhe |
| 3 | Aplicar SLA na criação do ticket (manual e webhook) | Calcular só no frontend | Fonte única de verdade no Main + persistência consistente |
| 4 | Matching por prioridade/grupo com precedência | Apenas uma regra global | Mantém flexibilidade operacional sem workflow completo |
| 5 | Indicador visual único (`SlaIndicator`) | Repetir badges por página | Consistência visual e menor duplicação |