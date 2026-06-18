# Relatório de Revisão Arquitetural — Autenticação & Usuários

**Data:** 2026-04-03
**Resultado:** ⚠️ Aprovado com ajustes

---

## Checklist

### Segurança (Electron)
- [x] Renderer não acessa Node.js diretamente — toda auth passa por IPC
- [x] IPC tipado via `src/lib/ipc.ts` (handlers em `electron/ipc/auth-ipc.ts`)
- [x] Novos handlers IPC adicionados em `electron/ipc/` — não em `main.ts`
- [x] Secrets (JWT secret, Cosmos DB connection) ficam apenas no Main Process via `electron-store`
- [x] Inputs validados com Zod antes de qualquer processamento

### Arquitetura de camadas
- [x] Lógica de negócio em `electron/services/auth.ts` e `electron/services/user.ts`
- [x] Componentes React responsáveis apenas por UI e chamadas ao `authStore`
- [x] Estado global via Zustand (`src/stores/authStore.ts`)
- [x] Tipo `User` já definido em `shared/types/index.ts` — sem duplicação
- [ ] ⚠️ Interface `ElectronAPI` em `shared/types/index.ts` não possui os novos métodos de gestão de usuários (`createUser`, `updateUser`, `resetPassword`, `toggleUserActive`, `listUsers`, `getSession`)
- [ ] ⚠️ `electron/preload.ts` não expõe os novos métodos de gestão de usuários — necessário adicionar ao contextBridge

### Banco de dados (Cosmos DB)
- [x] Container `users` bem definido — sem conflito com outros containers
- [x] Campos respeitam a estrutura existente de `User` em `shared/types`
- [x] Consultas simples por e-mail e id — baixo custo de RU
- [ ] ⚠️ O campo `active` e `passwordHash` estão na spec mas ausentes no tipo `User` de `shared/types/index.ts` — `passwordHash` não deve ir para o Renderer (correto omitir do tipo `User`), mas `active` deve ser adicionado ao tipo `User`

### Integração externa
- [x] Nenhuma integração externa nesta fase — N/A

### Consistência de UI
- [x] Componentes usarão shadcn/ui (`src/components/ui/`)
- [x] Classes Tailwind via `cn()` de `src/lib/utils.ts`
- [x] Sem cores hardcoded previstas

---

## Pontos de Atenção

### ⚠️ ElectronAPI incompleta para gestão de usuários
**Problema:** A interface `ElectronAPI` em `shared/types/index.ts` só declara `login` e `logout`.
Os novos handlers (`createUser`, `updateUser`, `resetPassword`, `toggleUserActive`, `listUsers`,
`getSession`) não estão declarados — o TypeScript do Renderer não conseguirá invocá-los com tipagem.

**Solução sugerida:** Adicionar os métodos à interface `ElectronAPI` antes de implementar os handlers,
e também expô-los no `contextBridge` em `electron/preload.ts`.

### ⚠️ Tipo `User` incompleto no shared/types
**Problema:** O tipo `User` exportado não inclui o campo `active: boolean`, que é necessário para
mostrar o status da conta na tela de gerenciamento de usuários.

**Solução sugerida:** Adicionar `active: boolean` ao tipo `User` em `shared/types/index.ts`.
O campo `passwordHash` **não deve** ser incluído — permanece apenas no Cosmos DB (Main Process).

---

## Decisão Final

**Aprovado com ajustes** — A spec está bem estruturada e alinhada com a arquitetura de segurança
do projeto. Os dois ajustes identificados são simples e devem ser feitos no início da implementação
(atualizar `shared/types/index.ts` e `electron/preload.ts`) antes de escrever os handlers e a UI.

**Próximo passo:** Iniciar desenvolvimento aplicando os ajustes acima como primeiro commit da fase.
