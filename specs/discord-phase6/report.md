# Relatório de Revisão Arquitetural — Notificações Discord Fase 6

**Data:** 2026-04-03
**Resultado:** ⚠️ Aprovado com ajustes

## Checklist

### Segurança (Electron)
- [x] Renderer não acessa Node.js diretamente na proposta
- [x] Webhooks Discord previstos exclusivamente no Main Process
- [x] CRUD previsto via IPC tipado
- [x] Validação de inputs com Zod prevista

### Arquitetura de camadas
- [x] Serviço dedicado proposto (`electron/services/discord.ts`)
- [x] Persistência separada proposta (`electron/services/discord-rule.ts`)
- [x] UI isolada em `src/pages/settings/DiscordNotificationsPage.tsx`
- [ ] ⚠️ `ElectronAPI` atual não possui métodos de regras Discord (list/create/update/delete)
- [ ] ⚠️ `electron/preload.ts` atual não expõe métodos de Discord rules

### Banco de dados (Cosmos DB)
- [x] Modelo `DiscordNotificationRule` já existe em `shared/types`
- [x] Container dedicado evita acoplamento com tickets
- [ ] ⚠️ Falta definir índices/estratégia para consulta por `triggerOn` + `active`

### Integração com fluxo de tickets
- [x] Eventos de gatilho estão alinhados ao domínio de tickets/SLA
- [x] Falha no webhook não interrompe operação principal
- [ ] ⚠️ Pontos exatos de disparo ainda precisam ser explicitados por operação (create/transition/assignee/SLA)

### Consistência de UI
- [x] Rota de settings para Discord já existe
- [ ] ⚠️ Página atual é placeholder e não possui tela de CRUD
- [ ] ⚠️ Necessário explicitar uso de tokens/estilo padrão do projeto para evitar hardcode

## Pontos de atenção

### ⚠️ Contrato IPC de Discord ainda ausente
**Problema:** Não há métodos de regras Discord no contrato tipado atual entre Renderer e Main.
**Solução sugerida:** Adicionar métodos de Discord em `shared/types/index.ts` e expor no `electron/preload.ts` antes da UI.

### ⚠️ Falta de definição de gatilhos por evento no código existente
**Problema:** A spec define eventos, mas a integração real depende de hooks nos serviços de ticket/workflow/SLA.
**Solução sugerida:** Mapear explicitamente em implementação onde cada evento será emitido e com qual payload de contexto.

### ⚠️ Observabilidade de falhas de webhook
**Problema:** Sem padrão de log estruturado, troubleshooting pode ficar difícil.
**Solução sugerida:** Definir formato mínimo de log com `ruleId`, `triggerOn`, `ticketId`, `statusCode` sem registrar webhook completo.

## Decisão final
Aprovado com ajustes — a spec está alinhada ao plano da Fase 6 e à arquitetura do projeto, porém exige formalização do contrato IPC, mapeamento claro dos gatilhos de evento e observabilidade de falhas antes do desenvolvimento.

**Próximo passo:** aprovação do responsável para iniciar implementação aplicando os ajustes acima no início da fase.