# Relatório de Revisão Arquitetural — Workflow Engine Fase 4

**Data:** 2026-04-03
**Resultado:** ⚠️ Aprovado com ajustes

## Checklist

### Segurança (Electron)
- [x] Renderer não acessa Node.js diretamente na proposta
- [x] Operações previstas via IPC tipado
- [x] Segredos permanecem no Main Process
- [x] Validação com Zod prevista para payloads e estrutura do workflow

### Arquitetura de camadas
- [x] Engine proposta em serviço dedicado (`electron/services/workflow.ts`)
- [x] Handlers previstos em `electron/ipc/workflow-ipc.ts`
- [x] UI (`/settings/workflows`) tratada como camada de configuração, sem regra de domínio embutida
- [x] Reuso de tipos compartilhados de workflow em `shared/types/index.ts`
- [ ] ⚠️ Contrato `ElectronAPI` atual ainda não contém métodos de workflow
- [ ] ⚠️ `electron/preload.ts` atual ainda não expõe métodos de workflow

### Banco de dados (Cosmos DB)
- [x] Modelo `Workflow` já existe e está alinhado com a spec
- [x] Uso de `workflowId` em ticket mantém referência explícita
- [x] Histórico de transições proposto melhora rastreabilidade
- [ ] ⚠️ Campo `workflowHistory` ainda não existe no tipo `Ticket` compartilhado

### Integração externa
- [x] Sem nova integração externa direta nesta fase
- [x] Fluxo de criação manual e webhook continua desacoplado por serviços do Main

### Consistência de UI
- [x] Feature mapeada para rota existente (`/settings/workflows`)
- [x] Consumo de estado previsto via contratos tipados
- [ ] ⚠️ Necessário explicitar na implementação o padrão visual com tokens (sem hardcode)

## Pontos de atenção

### ⚠️ Contrato IPC de workflow ainda não foi formalizado no código-base
**Problema:** A spec define novos métodos (`listWorkflows`, `createWorkflow`, `transitionTicketStep`, etc.), mas o contrato atual ainda não os declara no `ElectronAPI` nem no preload.
**Solução sugerida:** Incluir os novos métodos em `shared/types/index.ts` e `electron/preload.ts` como primeiro passo da implementação.

### ⚠️ Histórico de transição depende de atualização de tipo compartilhado
**Problema:** O `Ticket` atual não possui `workflowHistory`, mas a spec exige registro auditável de transições.
**Solução sugerida:** Adicionar o campo opcional em `shared/types/index.ts` e normalizar escrita/leitura no serviço de tickets.

### ⚠️ Guardrails de UI precisam permanecer explícitos
**Problema:** A página de workflows já existe, porém a spec precisa manter explícito que as decisões visuais devem usar tokens e componentes existentes (`shadcn/ui`, `cn`).
**Solução sugerida:** Manter esse requisito como critério de implementação na fase de desenvolvimento.

## Decisão final
Aprovado com ajustes — a spec está coerente com a arquitetura do projeto e com o roadmap da Fase 4, mas depende dos ajustes de contrato IPC/tipos compartilhados para reduzir risco de divergência entre Main e Renderer.

**Próximo passo:** aprovação do responsável para iniciar implementação da Fase 4 aplicando os ajustes acima no começo do desenvolvimento.