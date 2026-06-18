# Decisões de Design — Autenticação & Usuários

| # | Decisão | Alternativa considerada | Justificativa |
|---|---------|------------------------|---------------|
| 1 | Usar `jose` para JWT | `jsonwebtoken` | `jose` é ESM nativo, sem dependências nativas compiladas, funciona sem problema no Electron com electron-vite |
| 2 | Token armazenado no `electron-store` (Main Process) | `localStorage` no Renderer | Evita exposição do token no contexto web; alinhado com `contextIsolation: true` |
| 3 | Sem refresh token na Fase 1 | Refresh token + access token | Simplifica a implementação inicial; expiração de 8h é aceitável para uso interno em escritório |
| 4 | Contas criadas somente pelo admin | Auto-cadastro | Sistema interno — controle total de quem tem acesso |
| 5 | bcryptjs (custo 12) | argon2 | bcryptjs roda no Node.js sem binários nativos; argon2 requer recompilação para Electron (mais complexo) |
| 6 | Seed via CLI (`npm run seed:admin`) | Primeiro usuário criado na primeira tela de login | CLI evita expor fluxo de criação de admin na UI de produção |
| 7 | `active` boolean para desativar contas | Deletar usuário | Preserva histórico de tickets e apontamentos associados ao usuário |
| 8 | JWT secret gerado aleatoriamente na 1ª execução | Secret fixo em `.env` | Não exige configuração manual; secret único por instalação; armazenado no electron-store criptografado |
