# Skill: arch-review

## Quando usar
Execute esta skill APÓS a `spec-creator` e ANTES de começar a escrever código.
Valida se a Spec respeita a arquitetura definida do **gestec · help desk**.

## Objetivo
Revisar a Spec de uma feature contra os padrões arquiteturais estabelecidos,
identificar riscos e gerar um relatório de aprovação ou bloqueio.

## Regra obrigatória de versionamento
Após a implementação de uma spec aprovada por esta skill, o desenvolvimento deve
terminar com commit Git imediato (um commit por spec concluída), usando
Conventional Commits.

## Fluxo de execução

### 1. Leitura
Leia os seguintes arquivos:
- `specs/[feature]/spec.md` — a spec a ser revisada
- `shared/types/index.ts` — contrato de tipos compartilhados
- `electron/main.ts` — estrutura do Main Process
- `electron/preload.ts` — API IPC exposta
- `src/router.tsx` — rotas existentes
- `specs/index.md` — outras specs ativas (verificar conflitos)

### 2. Checklist de validação

#### Segurança (Electron)
- [ ] A feature **não** acessa Node.js diretamente no Renderer (sem `require`, `fs`, `path`)
- [ ] Toda comunicação Renderer ↔ Main usa `ipc` de `src/lib/ipc.ts`
- [ ] Novos handlers IPC são adicionados em `electron/ipc/` (não em `main.ts` diretamente)
- [ ] Secrets (tokens, connection strings) ficam **apenas** no Main Process
- [ ] Inputs validados com Zod antes de qualquer processamento

#### Arquitetura de camadas
- [ ] Lógica de negócio fica em serviços (`electron/services/`) ou `src/lib/` — não em componentes
- [ ] Componentes React são responsáveis apenas por UI e chamadas ao store/hooks
- [ ] Estado global via Zustand (`src/stores/`) — sem prop drilling excessivo
- [ ] Tipos novos adicionados em `shared/types/index.ts` (não duplicados por módulo)

#### Banco de dados (Cosmos DB)
- [ ] Novos campos respeitam a estrutura existente dos containers
- [ ] Embedded documents usados para dados de ciclo de vida do mesmo ticket/projeto
- [ ] Consultas complexas consideram custo de RU (Request Units) do Cosmos DB

#### Integração externa
- [ ] Toda comunicação com a plataforma externa passa por `electron/services/platform-integration.ts`
- [ ] Toda comunicação com Discord passa por `electron/services/discord.ts`
- [ ] Toda comunicação com Azure Blob passa por `electron/services/blob.ts`

#### Consistência de UI
- [ ] Componentes usam shadcn/ui (pasta `src/components/ui/`)
- [ ] Classes Tailwind via função `cn()` de `src/lib/utils.ts`
- [ ] Nenhuma cor hardcoded — usar tokens do tema (`text-primary`, `bg-muted`, etc.)

### 3. Geração do relatório

Crie `specs/[feature]/report.md`:

```markdown
# Relatório de Revisão Arquitetural — [Nome da Feature]

**Data:** YYYY-MM-DD
**Resultado:** ✅ Aprovado | ⚠️ Aprovado com ajustes | ❌ Bloqueado

## Checklist

### Segurança
- [x] Renderer não acessa Node.js diretamente
- [x] IPC tipado via src/lib/ipc.ts
- ...

### Arquitetura
- [x] ...
- [ ] ⚠️ [item que precisa de ajuste]

### Banco de dados
- [x] ...

## Pontos de atenção
### ⚠️ [Título do ajuste necessário]
**Problema:** [descrição]
**Solução sugerida:** [o que fazer]

## Decisão final
[Aprovado | Aprovado com ajustes | Bloqueado] — [justificativa em 1-2 frases]

**Próximo passo:** [iniciar desenvolvimento | corrigir spec e revisar novamente]
```

### 4. Comunicar resultado
Informe ao usuário o resultado e, se houver ajustes:
- Liste exatamente o que precisa ser corrigido na spec
- Aguarde confirmação antes de autorizar o início do desenvolvimento

### 5. Após implementação da spec aprovada
- Confirmar que os critérios de aceite da spec foram verificados
- Atualizar status da spec para `done` (ou estado correspondente em andamento)
- Realizar commit Git imediatamente após finalizar a implementação
- Informar ao usuário a mensagem e o hash do commit
