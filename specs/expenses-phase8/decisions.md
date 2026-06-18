# Decisões de Design — Despesas & Anexos Fase 8

| # | Decisão | Alternativa considerada | Justificativa |
|---|---------|------------------------|---------------|
| 1 | Gestão de despesas/anexos permitida para qualquer usuário autenticado | Restringir CRUD a `manager` e `admin` | Mantém operação mais fluida no dia a dia e reduz bloqueio de execução para o time técnico |
| 2 | Suportar anexos em dois níveis (despesa e entidade ticket/projeto) | Somente comprovante de despesa | Atende documentação financeira e anexos operacionais não financeiros |
| 3 | Serviço dedicado `electron/services/blob.ts` para operações de arquivo | Upload direto por handlers IPC | Centraliza segurança, retry/log e reduz duplicação |
| 4 | Metadados de anexos em estrutura compartilhada reutilizável | Campos soltos em cada módulo | Mantém consistência de contrato e facilita evolução |
| 5 | Erros padronizados para upload/anexo (`FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`, etc.) | Mensagens livres por serviço | Facilita UX, testes e observabilidade |
| 6 | Política explícita para blobs órfãos em exclusões | Sem política definida na fase | Evita custo crescente e inconsistência em storage |
| 7 | Validação forte de payload e arquivos no Main Process (Zod) | Validar apenas no frontend | Segurança e garantia de integridade dos dados |
