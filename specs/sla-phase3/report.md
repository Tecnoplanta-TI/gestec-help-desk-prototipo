# Relatório de Revisão Arquitetural — SLA Fase 3

**Data:** 2026-04-03
**Resultado:** ⚠️ Aprovado com ajustes

## Checklist

### Segurança
- [x] Renderer não acessa Node.js diretamente
- [x] Persistência prevista no Main Process
- [x] Validação de inputs com Zod prevista
- [x] Sem exposição de secrets no Renderer

### Arquitetura
- [x] Cálculo concentrado em `src/lib/sla.ts` (funções puras)
- [x] Uso de IPC para CRUD de regras de SLA
- [x] Uso de tipos compartilhados em `shared/types/index.ts`
- [ ] ⚠️ Falta explicitar na spec que CRUD de SLA é restrito a `admin`

### Banco de dados (Cosmos DB)
- [x] Modelo `SlaRule` compatível com tipos atuais
- [x] Ticket já possui estrutura `sla` necessária
- [ ] ⚠️ Falta critério de desempate quando múltiplas regras tiverem a mesma especificidade

### Integração externa
- [x] Aplicação de SLA prevista tanto para ticket manual quanto webhook
- [x] Mantém separação por camadas (ingestão em Main Process)

### Consistência de UI
- [x] Indicador visual de SLA em lista/kanban/detalhe previsto
- [x] Uso de tokens/classes de tema previsto (sem hardcode visual)
- [ ] ⚠️ `SlaIndicator` é dependência da spec, mas componente ainda não existe no projeto; incluir criação explícita na implementação

## Pontos de atenção

### ⚠️ Permissão de gestão de SLA não definida
**Problema:** A spec não explicita quem pode criar/editar/remover regras de SLA.
**Solução sugerida:** Definir que operações de CRUD de SLA são exclusivas para `admin`, com validação no Main Process.

### ⚠️ Empate entre regras de SLA
**Problema:** A ordem de matching está definida, mas não existe regra para empate no mesmo nível de prioridade (ex.: duas regras prioridade+grupo).
**Solução sugerida:** Definir critério determinístico (ex.: `updatedAt` mais recente vence, ou prioridade manual por campo `weight`).

### ⚠️ Entrega de componente visual não explicitada como artefato
**Problema:** O uso de `SlaIndicator` está no texto, mas sem declarar de forma explícita a criação do arquivo no escopo da fase.
**Solução sugerida:** Incluir no escopo de implementação a criação de `src/components/tickets/SlaIndicator.tsx` e sua adoção nas três telas.

## Decisão final
Aprovado com ajustes — a spec está alinhada à arquitetura base, porém requer explicitação de permissões, regra de desempate e artefato visual para reduzir ambiguidades de implementação.

**Próximo passo:** ajustar a spec e validar com o solicitante antes de iniciar o desenvolvimento.