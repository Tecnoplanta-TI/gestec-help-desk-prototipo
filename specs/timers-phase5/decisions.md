# Decisões de Design — Cronômetros Fase 5

| # | Decisão | Alternativa considerada | Justificativa |
|---|---------|------------------------|---------------|
| 1 | Container dedicado `active_timers` para estado vivo | Guardar em memória apenas | Suporta retomada após restart e múltiplas janelas |
| 2 | Cálculo de tempo no Main Process | Cálculo no Renderer | Evita divergência de relógio entre janelas e melhora consistência |
| 3 | Emissão de `timer:tick` via IPC Main -> Renderer | Polling do Renderer | Menor acoplamento e atualização centralizada |
| 4 | `stop` gera `Appointment` automático para tickets | Usuário lançar manualmente depois | Mantém rastreabilidade automática do tempo real trabalhado |
| 5 | Controle de timers por `technicianId` | Timers globais sem dono | Evita manipulação cruzada entre usuários |
| 6 | Janela flutuante usa mesmo preload e contrato IPC | API separada para janela flutuante | Reduz duplicação e risco de inconsistência |
| 7 | `pause` idempotente (não falha se já pausado) | Lançar erro sempre | Simplifica UX e integrações de botões rápidos |