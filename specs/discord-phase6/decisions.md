# Decisões de Design — Notificações Discord Fase 6

| # | Decisão | Alternativa considerada | Justificativa |
|---|---------|------------------------|---------------|
| 1 | Container dedicado `discord_notification_rules` | Guardar regras em config local | Persistência multiusuário e governança centralizada |
| 2 | Avaliação e envio no Main Process | Chamada webhook no Renderer | Segurança de secrets e menor exposição de superfície |
| 3 | Motor de template com placeholders controlados | Template livre sem validação | Evita runtime errors e mensagens quebradas |
| 4 | Falha de webhook não bloqueia fluxo de ticket | Bloquear transação do ticket em erro de notificação | Notificação é efeito colateral, não operação crítica |
| 5 | CRUD restrito a `admin` | CRUD aberto para `manager` | Reduz risco de regra incorreta em produção |
| 6 | Múltiplas regras por evento permitidas | Regra única por evento | Maior flexibilidade por centro de custo/prioridade/grupo |
| 7 | Funções de condição/interpolação puras e testáveis | Lógica embutida em handler | Facilita manutenção e testes unitários |