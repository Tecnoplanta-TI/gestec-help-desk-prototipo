# Spec: Autenticação & Usuários

**Status:** done
**Data:** 2026-04-03
**Fase do roadmap:** Fase 1 — Autenticação & Usuários

---

## Contexto

O gestec · help desk precisa de um sistema de autenticação local (sem dependência de servidor externo),
pois a aplicação roda como desktop Electron em Windows. Contas são criadas exclusivamente pelo
administrador — não há auto-cadastro. O primeiro administrador é provisionado via script CLI.

---

## Requisitos Funcionais

- RF01: O sistema deve autenticar usuários com e-mail e senha (hash bcryptjs, JWT assinado com jose).
- RF02: O token JWT deve ser armazenado de forma segura no Main Process via `electron-store` criptografado.
- RF03: O Renderer jamais deve ter acesso direto ao token — toda operação autenticada passa por IPC.
- RF04: O administrador pode criar novas contas (nome, e-mail, senha inicial, papel).
- RF05: O administrador pode editar nome, e-mail, papel e redefinir senha de qualquer usuário.
- RF06: O administrador pode desativar/reativar contas (não deletar, para preservar histórico).
- RF07: O sistema deve suportar três papéis: `member`, `manager`, `admin`.
- RF08: O primeiro administrador deve ser provisionado via `npm run seed:admin` (CLI interativo).
- RF09: O JWT deve expirar em 8 horas; ao expirar, o usuário é redirecionado para o login.
- RF10: Após login bem-sucedido, o usuário é direcionado para `/tickets`.
- RF11: Logout limpa o token do `electron-store` e redireciona para `/login`.

---

## Requisitos Não-funcionais

- RNF01: Hash bcryptjs com custo 12 (seguro e aceitável para desktop).
- RNF02: O token JWT nunca deve ser exposto no Renderer Process.
- RNF03: Senhas nunca armazenadas em texto claro — somente hash.
- RNF04: Operações de login devem completar em < 1 s em hardware normal.
- RNF05: Inputs validados com Zod antes de qualquer processamento no Main Process.
- RNF06: Rate limiting no servidor Fastify para rota `/auth/login` (máx. 5 tentativas/min por IP).

---

## Casos de Uso

### UC01 — Login
**Ator:** Qualquer usuário registrado
**Fluxo principal:**
1. Usuário abre a aplicação → tela de login exibida.
2. Usuário informa e-mail e senha e clica em "Entrar".
3. Renderer chama `ipc.login({ email, password })`.
4. Main Process valida Zod, busca usuário no Cosmos DB, compara hash bcryptjs.
5. Gera JWT (jose), armazena no `electron-store`, retorna `{ user, expiresAt }`.
6. Renderer atualiza `authStore`, redireciona para `/tickets`.

**Fluxo alternativo — credenciais inválidas:**
- Main Process retorna erro `{ code: 'INVALID_CREDENTIALS' }`.
- Renderer exibe mensagem "E-mail ou senha incorretos." (sem indicar qual campo falhou).

**Fluxo alternativo — conta desativada:**
- Main Process retorna erro `{ code: 'ACCOUNT_DISABLED' }`.
- Renderer exibe mensagem "Conta desativada. Contate o administrador."

### UC02 — Logout
**Ator:** Usuário autenticado
**Fluxo principal:**
1. Usuário clica em "Sair" no menu lateral.
2. Renderer chama `ipc.logout()`.
3. Main Process remove token do `electron-store`.
4. Renderer limpa `authStore`, redireciona para `/login`.

### UC03 — Criar Conta de Usuário
**Ator:** Administrador
**Fluxo principal:**
1. Admin navega para Configurações → Usuários → "Novo usuário".
2. Preenche: nome, e-mail, papel (`member` | `manager` | `admin`), senha inicial.
3. Renderer chama `ipc.createUser({ name, email, role, password })`.
4. Main Process valida Zod, verifica e-mail duplicado, gera hash, persiste no Cosmos DB.
5. Retorna usuário criado (sem hash).

**Exceção — e-mail duplicado:**
- Retorna erro `{ code: 'EMAIL_ALREADY_EXISTS' }`.
- Renderer exibe "Já existe um usuário com esse e-mail."

### UC04 — Editar Usuário
**Ator:** Administrador
**Fluxo principal:**
1. Admin clica em um usuário na lista → modal de edição.
2. Edita nome, e-mail ou papel → salva.
3. Renderer chama `ipc.updateUser({ id, name, email, role })`.
4. Main Process valida e persiste no Cosmos DB.

### UC05 — Redefinir Senha
**Ator:** Administrador
**Fluxo principal:**
1. Admin clica em "Redefinir senha" no modal do usuário.
2. Informa nova senha → confirma.
3. Renderer chama `ipc.resetPassword({ userId, newPassword })`.
4. Main Process gera novo hash, atualiza no Cosmos DB.

### UC06 — Desativar / Reativar Conta
**Ator:** Administrador
**Fluxo principal:**
1. Admin clica em "Desativar" ou "Reativar" na linha do usuário.
2. Renderer chama `ipc.toggleUserActive({ userId, active: false | true })`.
3. Main Process atualiza campo `active` no Cosmos DB.
- Administrador não pode desativar a própria conta.

### UC07 — Seed do Primeiro Admin (CLI)
**Ator:** Desenvolvedor/TI na instalação inicial
**Fluxo principal:**
1. Executar `npm run seed:admin`.
2. CLI solicita: nome, e-mail, senha.
3. Script verifica se já existe admin no Cosmos DB.
4. Cria usuário com papel `admin` e `active: true`.
5. Exibe confirmação no terminal.

---

## Modelo de Dados Afetado

### Container: `users` (Cosmos DB)
```typescript
interface User {
  id: string;           // ULID
  name: string;
  email: string;        // único, lowercase
  passwordHash: string; // bcryptjs, custo 12
  role: 'member' | 'manager' | 'admin';
  active: boolean;      // false = desativado
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
}
```

### electron-store (Main Process)
```typescript
{
  auth: {
    token: string;      // JWT assinado
    userId: string;
    expiresAt: string;  // ISO 8601
  } | null
}
```

---

## Critérios de Aceite

- [ ] CA01: Login com credenciais válidas redireciona para `/tickets` e exibe nome do usuário no sidebar.
- [ ] CA02: Login com senha errada exibe mensagem genérica sem travar a conta.
- [ ] CA03: Token JWT expirado redireciona automaticamente para `/login` sem erro visível.
- [ ] CA04: Admin consegue criar, editar, redefinir senha e desativar usuários pela UI.
- [ ] CA05: Admin não consegue desativar a própria conta (botão desabilitado ou erro claro).
- [ ] CA06: Usuário desativado recebe mensagem específica ao tentar logar.
- [ ] CA07: `npm run seed:admin` cria primeiro admin e impede criação duplicada.
- [ ] CA08: Logout limpa sessão e redireciona para `/login`; tecla voltar não retorna à área logada.
- [ ] CA09: Rota protegida acessada sem autenticação redireciona para `/login`.
- [ ] CA10: Toda comunicação de autenticação usa IPC — nenhuma chamada Cosmos DB ocorre no Renderer.

---

## Dependências

- **Requer:** Fase 0 concluída (Electron + Vite + React + Cosmos DB + Fastify configurados).
- **Afeta:** Todas as outras fases dependem do `authStore` e da lógica de permissão.

---

## Notas de Implementação

- **IPC handlers** novos em `electron/ipc/auth-ipc.ts`: `login`, `logout`, `getSession`, `createUser`,
  `updateUser`, `resetPassword`, `toggleUserActive`, `listUsers`.
- **Serviço** `electron/services/auth.ts`: lógica bcryptjs e jose isolada do handler IPC.
- **Serviço** `electron/services/user.ts`: CRUD de usuários no Cosmos DB.
- **Script** `electron/scripts/seed-admin.ts` (executado via `ts-node` ou compilado).
- **JWT secret** gerado aleatoriamente na primeira execução e armazenado no `electron-store`
  (`crypto.randomBytes(32).toString('hex')`).
- Usar `jose` (SignJWT / jwtVerify) — não `jsonwebtoken`, pois `jose` é ESM nativo e funciona bem
  no contexto Electron com electron-vite.
- **Validação Zod** em cada handler antes de qualquer acesso ao Cosmos DB.
- **Permissões futuras:** `authStore` expõe `user.role`; guards de rota verificarão o papel conforme
  necessário nas fases seguintes.
