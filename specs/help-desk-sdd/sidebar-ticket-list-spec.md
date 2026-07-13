# Especificacao SDD: tickets, acompanhamento, IDs e SLA

## Diagnostico

- `/tickets` e `/tickets/mine` usavam a mesma pagina e resolviam o mesmo escopo inicial.
- A API local ignorava `scope` quando `queue: 'all'`, entao a separacao era visualmente insuficiente.
- O escopo `mine` significava solicitacoes abertas pelo usuario, nao fila de trabalho atribuida.
- IDs visiveis misturavam `GHD-2026-0001`, UUID e fatias de UUID.
- Algumas etapas vinham do workflow seedado em ingles e sobrescreviam labels traduzidos.
- A coluna/linha `Origem` era exibida na lista, detalhe e kanban.
- `SlaIndicator` era um pill inline sem quebra, permitindo overflow em tabelas/cards.

## Fonte de verdade

### Rotas

- `/tickets`: fila de trabalho do usuario logado. Deve listar somente tickets atualmente atribuidos ao usuario.
- `/tickets/mine`: acompanhamento amplo. Deve listar tickets que o usuario pode consultar: solicitante, participante, atribuido ou acessivel por permissao/funcao.

### Permissoes e dados

- A regra deve existir em `shared/lib/ticket-access.ts` e ser aplicada pela API local em `src/lib/local-api.ts`.
- Fila de trabalho usa atribuicao atual (`assigneeId`, `additionalAssigneeId`, `triageAssigneeId`, gestores/aprovadores quando a etapa exige aprovacao).
- Acompanhamento usa `userCanAccessTicket`.

### ID publico

- Todo ticket visivel deve usar `ticket.ticketNumber` no formato `#` seguido de 1 a 9 digitos.
- `ticket.id` permanece como identificador tecnico interno.
- Registros antigos com outro formato sao normalizados pela API local sem quebrar relacionamentos.

### Interface

- Remover `Origem` de lista, detalhe e cards.
- Labels de etapas sempre usam portugues (`WORKFLOW_STEP_LABELS`) quando houver label conhecido.
- `SlaIndicator` deve quebrar texto, respeitar largura do container e funcionar dentro de tabela/cards.

## Evidencia esperada

- Typecheck e build passando.
- Testes unitarios para fila atribuida, acompanhamento amplo e ID publico.
