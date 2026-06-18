# Relatório de Revisão Arquitetural — Projetos & Tarefas Fase 7

**Data:** 2026-04-03
**Resultado:** ⚠️ Aprovado com ajustes

## Checklist

### Segurança (Electron)
- [x] A proposta mantém Renderer sem acesso direto a Node.js.
- [x] Operações previstas exclusivamente por IPC (`src/lib/ipc.ts` + preload).
- [x] Segredos permanecem no Main Process.
- [x] Validação com Zod prevista para payloads de CRUD e apontamentos.

### Arquitetura de camadas
- [x] Regra de domínio prevista em serviço dedicado (`electron/services/project.ts`).
- [x] Handlers previstos em módulo dedicado (`electron/ipc/project-ipc.ts`).
- [x] Páginas de projeto permanecem como camada de UI.
- [ ] ⚠️ `ElectronAPI` ainda não possui métodos de projeto/tarefa/apontamento.
- [ ] ⚠️ `electron/preload.ts` ainda não expõe canais IPC de projeto.

### Banco de dados (Cosmos DB)
- [x] Modelo `Project`/`ProjectTask` já existe em `shared/types/index.ts`.
- [x] Uso de tarefas embutidas em `Project.tasks` está alinhado ao contrato atual.
- [ ] ⚠️ A spec ainda precisa explicitar estratégia para atualização concorrente de tarefas embutidas (controle por `updatedAt`/checagem otimista).

### Integração entre módulos
- [x] Reuso do timer para `project_task` está consistente com Fase 5.
- [x] Escopo não introduz integração externa adicional.
- [ ] ⚠️ Pontos de integração entre `timer:stop` e persistência de tarefa precisam ser declarados de forma explícita (serviço alvo e fluxo de erro).

### Consistência de UI
- [x] Escopo cobre substituição dos placeholders em `/projects` e `/projects/:id`.
- [x] Mantém padrão de componentes shadcn/ui e tokens de tema.
- [ ] ⚠️ Falta detalhar critério de paginação/virtualização caso a lista de projetos cresça significativamente.

## Pontos de atenção

### ⚠️ Contrato IPC de projetos ainda ausente
**Problema:** O contrato tipado atual (`shared/types/index.ts`) e o preload não possuem métodos para projetos e tarefas.  
**Solução sugerida:** Incluir as assinaturas no `ElectronAPI` e expor os canais em `electron/preload.ts` antes do desenvolvimento da UI.

### ⚠️ Conflito de escrita em tarefas embutidas
**Problema:** Com `tasks` embutidas no documento de projeto, atualizações simultâneas podem sobrescrever alterações.  
**Solução sugerida:** Definir estratégia mínima na implementação (checagem de `updatedAt` + retry controlado, ou operação de patch por ID de tarefa no serviço).

### ⚠️ Integração timer -> tarefa precisa de contrato de erro
**Problema:** A Fase 5 já suporta `project_task`, mas a persistência de apontamento final em tarefa ainda depende de integração explícita.  
**Solução sugerida:** Padronizar erros (`PROJECT_TASK_NOT_FOUND`, `FORBIDDEN`, `INVALID_TIMER_TARGET`) e registrar fallback sem corromper estado do timer.

## Decisão final
Aprovado com ajustes — a spec está alinhada ao roadmap e à arquitetura atual do projeto, mas depende da formalização do contrato IPC e da estratégia de atualização concorrente para reduzir risco na implementação.

**Próximo passo:** aguardar aprovação para iniciar o desenvolvimento da Fase 7 aplicando os ajustes acima no início da execução.
