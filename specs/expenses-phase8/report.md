# Relatório de Revisão Arquitetural — Despesas & Anexos Fase 8

**Data:** 2026-04-04
**Resultado:** ⚠️ Aprovado com ajustes

## Checklist

### Segurança (Electron)
- [x] A proposta mantém Renderer sem acesso direto a Node.js.
- [x] Operações previstas via IPC tipado.
- [x] Segredos de Azure continuam restritos ao Main Process.
- [x] Validação com Zod está prevista para payload e upload.
- [x] Política de acesso da fase alinhada: operações permitidas para qualquer usuário autenticado.

### Arquitetura de camadas
- [x] Regra de domínio prevista em serviços do Main Process.
- [x] UI permanece como camada de apresentação em ticket/projeto.
- [ ] ⚠️ `ElectronAPI` atual ainda não possui métodos de despesas/anexos da Fase 8.
- [ ] ⚠️ `electron/preload.ts` ainda não expõe canais de despesas/anexos.
- [ ] ⚠️ `src/lib/ipc.ts` exigirá extensão para novos contratos.

### Banco de dados (Cosmos DB)
- [x] Estruturas atuais já possuem `expenses` em `Ticket` e `Project`.
- [ ] ⚠️ Tipo `Expense` atual suporta apenas `invoiceBlobUrl` único; a fase requer múltiplos anexos e metadados.
- [ ] ⚠️ Anexos diretos de entidade (ticket/projeto) ainda não estão modelados em `shared/types/index.ts`.

### Integração externa (Azure Blob)
- [x] Escopo de integração está corretamente no Main Process.
- [ ] ⚠️ Não existe hoje `electron/services/blob.ts` no código-base para centralizar upload/download/remover.
- [ ] ⚠️ Estratégia de observabilidade e tratamento de falhas de Blob precisa ser formalizada na implementação.

### Consistência de UI
- [x] Rotas de detalhe de ticket/projeto já existem em `src/router.tsx`.
- [ ] ⚠️ Critérios de UI para seção de anexos/despesas devem reforçar uso de shadcn/ui e tokens do tema, sem hardcode.

## Pontos de atenção

### ⚠️ Contrato IPC da Fase 8 ainda ausente no código-base
**Problema:** O contrato atual não possui métodos para CRUD de despesas/anexos nem operações de arquivo.
**Solução sugerida:** Expandir `shared/types/index.ts`, `electron/preload.ts` e `src/lib/ipc.ts` com métodos da Fase 8 antes de iniciar UI.

### ⚠️ Modelo de despesa/anexo incompleto para o escopo aprovado
**Problema:** `Expense` atual cobre apenas `invoiceBlobUrl` único e não contempla anexos diretos de entidade.
**Solução sugerida:** Introduzir metadados de anexos reutilizáveis e atualizar `Ticket`/`Project` para refletir anexos de despesa e anexos diretos.

### ⚠️ Serviço de Blob ainda não implementado
**Problema:** A arquitetura prevê integração com Azure Blob, mas o serviço dedicado ainda não existe.
**Solução sugerida:** Criar `electron/services/blob.ts` com API única para upload/download/delete, validações e logs de erro padronizados.

## Decisão final

⚠️ Aprovado com ajustes — A spec está consistente com o plano e com a arquitetura alvo, mas exige formalização prévia do contrato IPC, evolução dos tipos compartilhados e criação do serviço de Blob para reduzir risco de retrabalho.

**Próximo passo:** iniciar implementação da Fase 8 aplicando os ajustes acima no primeiro commit técnico da fase.
