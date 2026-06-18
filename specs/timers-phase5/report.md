# Relatório de Revisão Arquitetural — Cronômetros Fase 5

**Data:** 2026-04-03
**Resultado:** ⚠️ Aprovado com ajustes

## Checklist

### Segurança (Electron)
- [x] Proposta mantém Renderer sem acesso direto a Node.js
- [x] Operações de timer previstas via IPC tipado
- [x] Segredos permanecem exclusivos do Main Process
- [x] Validação Zod prevista para payloads de timer

### Arquitetura de camadas
- [x] Lógica de domínio proposta em serviço dedicado (`electron/services/timer.ts`)
- [x] Handlers previstos em módulo dedicado (`electron/ipc/timer-ipc.ts`)
- [x] Store de UI (`src/stores/timerStore.ts`) permanece como estado de apresentação
- [ ] ⚠️ `ElectronAPI` já declara métodos de timer, mas não há handlers registrados no Main atualmente
- [ ] ⚠️ Não existe hoje serviço de timer no Main para sustentar `start/pause/stop/getActive`

### Banco de dados (Cosmos DB)
- [x] Uso de container dedicado `active_timers` é compatível com arquitetura atual
- [x] Apontamentos automáticos reaproveitam `appointments` em `Ticket`
- [ ] ⚠️ Definir estratégia de cleanup para timers órfãos/stopped no container

### Integração entre módulos
- [x] Fluxo de `stop` acopla corretamente com domínio de tickets (apontamento automático)
- [x] Preparação para `project_task` está prevista sem bloquear Fase 5
- [ ] ⚠️ Falta explicitar contrato de erro padronizado para timer (`TIMER_NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE`)

### Consistência de UI
- [x] Janela flutuante prevista com controle `open/close/pin`
- [x] Atualização em tempo real prevista por `timer:tick`
- [ ] ⚠️ Rota/renderer da janela flutuante ainda não existe explicitamente no projeto atual

## Pontos de atenção

### ⚠️ Contrato IPC de timer existe no preload, mas backend ainda ausente
**Problema:** `electron/preload.ts` expõe `timer:start|pause|stop|get-active`, porém não há handlers correspondentes registrados no Main.
**Solução sugerida:** Implementar `electron/ipc/timer-ipc.ts` e registrar `registerTimerHandlers()` em `electron/main.ts` como primeiro passo.

### ⚠️ Ausência de renderer dedicado para janela flutuante
**Problema:** Main tenta carregar rota/arquivo da janela flutuante, mas o app ainda não possui artefato renderer explícito para esse contexto.
**Solução sugerida:** Definir entrada de renderer da janela flutuante (rota dedicada ou página específica) e validar bootstrap em dev/prod.

### ⚠️ Governança de estados inválidos de timer
**Problema:** Sem contrato claro, operações como `pause` em timer parado podem gerar comportamento inconsistente.
**Solução sugerida:** Definir tabela de transição de estados (`running`, `paused`, `stopped`) e códigos de erro padronizados.

## Decisão final
Aprovado com ajustes — a spec está alinhada ao plano da Fase 5 e à arquitetura do projeto, mas depende da formalização do backend de timer, renderer da janela flutuante e governança de estados para evitar lacunas de implementação.

**Próximo passo:** aprovação do responsável para iniciar implementação aplicando os ajustes acima no começo da fase.