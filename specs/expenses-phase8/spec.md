# Spec: Despesas & Anexos — Registro de Custos e Comprovantes

**Status:** review
**Data:** 2026-04-04
**Fase do roadmap:** Fase 8 — Despesas & Anexos

## Contexto

Com tickets, cronômetros e projetos já definidos nas fases anteriores, a aplicação precisa consolidar
custos operacionais associados a atendimento e trabalho interno. A Fase 8 introduz gestão de despesas
com comprovantes no Azure Blob e também anexos diretos em ticket/projeto para documentação complementar.

## Requisitos Funcionais

- RF01: Permitir CRUD de despesas vinculadas a `ticket` e `project`.
- RF02: Cada despesa deve conter `description`, `supplier?`, `quantity`, `unitValue`, `totalValue`.
- RF03: `totalValue` deve ser calculado e validado com base em `quantity * unitValue`.
- RF04: Permitir upload de múltiplos comprovantes por despesa (PDF/imagem), armazenando metadados do arquivo.
- RF05: Permitir remoção de comprovante de despesa sem remover a despesa inteira.
- RF06: Permitir anexos diretos em `ticket` e `project`, sem obrigatoriedade de vínculo com despesa.
- RF07: Permitir listagem de despesas e anexos no detalhe da entidade (`/tickets/:id` e `/projects/:id`).
- RF08: Permitir criação/edição/exclusão de despesas e anexos para qualquer usuário autenticado no Main Process.
- RF09: Leitura/listagem de despesas e anexos deve exigir usuário autenticado.
- RF10: Toda operação de upload/download de arquivo deve passar por serviço dedicado de Blob no Main Process.
- RF11: Falha de upload no Blob não deve corromper o estado da despesa/anexo já persistido.
- RF12: Exclusão de despesa deve limpar vínculo dos comprovantes e aplicar política definida para blobs órfãos.

## Requisitos Não-funcionais

- RNF01: Renderer não acessa Node.js, filesystem nem credenciais do Azure diretamente.
- RNF02: Todas as entradas de CRUD e upload devem ser validadas com Zod no Main Process.
- RNF03: Tipos compartilhados de despesa/anexo devem ficar centralizados em `shared/types/index.ts`.
- RNF04: Contratos IPC devem ser expostos por `src/lib/ipc.ts` e `electron/preload.ts`, com tipagem completa.
- RNF05: Política de arquivos deve bloquear tipos não permitidos e tamanho acima do limite definido.
- RNF06: Erros de domínio devem ser padronizados (`UNAUTHENTICATED`, `ENTITY_NOT_FOUND`, `UNSUPPORTED_FILE_TYPE`, `FILE_TOO_LARGE`, `BLOB_UPLOAD_FAILED`).
- RNF07: Chaves de blob devem seguir padrão determinístico por entidade para facilitar rastreabilidade e limpeza.
- RNF08: UI de despesas e anexos deve usar componentes/tokens padrão do projeto (sem hardcode visual).

## Casos de Uso

### UC01 — Criar despesa com comprovante
**Ator:** usuário autenticado  
**Fluxo principal:**
1. Usuário abre detalhe de ticket/projeto e inicia criação de despesa.
2. Informa dados da despesa e seleciona um ou mais arquivos de comprovante.
3. Sistema valida payload e arquivos.
4. Sistema persiste despesa e metadados dos comprovantes.
5. UI atualiza lista de despesas com total e anexos.
**Fluxo alternativo / exceção:**
- Arquivo inválido (tipo/tamanho): operação bloqueada com erro claro.
- Falha no Blob: operação retorna erro padronizado sem persistência inconsistente.

### UC02 — Editar e excluir despesa
**Ator:** usuário autenticado  
**Fluxo principal:**
1. Usuário seleciona despesa existente.
2. Atualiza campos permitidos.
3. Sistema recalcula/valida `totalValue`.
4. Usuário pode excluir a despesa.
5. Sistema remove vínculo de comprovantes conforme política da fase.
**Fluxo alternativo / exceção:**
- Entidade não encontrada: erro `ENTITY_NOT_FOUND`.
- Usuário não autenticado: erro `UNAUTHENTICATED`.

### UC03 — Gerenciar comprovantes de despesa
**Ator:** usuário autenticado  
**Fluxo principal:**
1. Usuário adiciona comprovante em despesa existente.
2. Sistema registra novo item de comprovante.
3. Usuário remove comprovante individual quando necessário.
**Fluxo alternativo / exceção:**
- Upload falhou: erro `BLOB_UPLOAD_FAILED`.

### UC04 — Gerenciar anexos diretos de ticket/projeto
**Ator:** usuário autenticado  
**Fluxo principal:**
1. Usuário acessa seção de anexos da entidade.
2. Faz upload de arquivo sem criar despesa.
3. Arquivo passa a aparecer na lista de anexos da entidade.
4. Usuário pode excluir anexo direto.
**Fluxo alternativo / exceção:**
- Sem autenticação: operação negada.

## Modelo de Dados Afetado

### Ajustes em tipos compartilhados
- Evoluir `Expense` para suportar múltiplos comprovantes via coleção de metadados.
- Introduzir estrutura de metadados de arquivo (ex.: `AttachmentFile`) reaproveitável para:
  - comprovantes de despesa;
  - anexos diretos de ticket/projeto.

### Ajustes em entidades existentes
- `Ticket.expenses[]`: manter despesas com comprovantes associados.
- `Project.expenses[]`: manter despesas com comprovantes associados.
- `Ticket` e `Project`: incluir coleção de anexos diretos da entidade.

### Contrato IPC (novos métodos)
- `listEntityExpenses(entityType, entityId)`
- `createEntityExpense(payload)`
- `updateEntityExpense(payload)`
- `deleteEntityExpense(payload)`
- `uploadExpenseAttachment(payload)`
- `deleteExpenseAttachment(payload)`
- `listEntityAttachments(entityType, entityId)`
- `uploadEntityAttachment(payload)`
- `deleteEntityAttachment(payload)`
- `getAttachmentDownloadUrl(payload)`

## Critérios de Aceite

- [ ] CA01: Usuário autenticado consegue criar despesa em ticket com dados válidos.
- [ ] CA02: Usuário autenticado consegue criar despesa em projeto com dados válidos.
- [ ] CA03: `totalValue` é calculado corretamente em criação e edição.
- [ ] CA04: Upload de comprovante válido é persistido e aparece na lista da despesa.
- [ ] CA05: Upload de arquivo inválido (tipo não suportado) é bloqueado com erro claro.
- [ ] CA06: Upload de arquivo acima do limite é bloqueado com erro claro.
- [ ] CA07: Exclusão de comprovante remove o item da despesa sem quebrar os demais.
- [ ] CA08: Anexo direto em ticket pode ser criado e removido.
- [ ] CA09: Anexo direto em projeto pode ser criado e removido.
- [ ] CA10: Usuário não autenticado não consegue criar/editar/excluir despesas ou anexos.
- [ ] CA11: Falha de Blob retorna erro padronizado sem gravar estado inconsistente.
- [ ] CA12: Listagens de detalhe de ticket/projeto exibem despesas e anexos sem acesso direto do Renderer ao Blob/Cosmos.

## Dependências

- Requer: Fase 2 (Tickets) e Fase 7 (Projetos) para entidades alvo existentes.
- Requer: Estratégia de autenticação/autorização da Fase 1.
- Afeta: `shared/types/index.ts`, `electron/preload.ts`, `src/lib/ipc.ts`, handlers IPC de ticket/projeto e serviço dedicado de Blob.

## Notas de implementação

- Criar serviço dedicado `electron/services/blob.ts` para upload/download/remoção de arquivos.
- Centralizar regras de autorização por role no Main Process, sem confiar em validação do Renderer.
- Definir política explícita para limpeza de blobs órfãos na remoção de despesas/anexos.
- Registrar logs estruturados de falhas de Blob para rastreabilidade operacional.
