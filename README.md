# gestec help desk

SPA React local-first para suporte tecnico. O app roda inteiramente no navegador, sem backend, sem camada desktop e sem tela de login.

## Desenvolvimento

```bash
npm run dev
npm run typecheck
npm run build
```

`npm run dev` abre o Vite em `http://localhost:5173`. O build estatico sai em `dist/`.

## Sessao local

No primeiro acesso, a API local cria um usuario administrador e abre uma sessao local automaticamente. O modulo assume que o site hospedeiro ja controla acesso/autenticacao.

## Persistencia

Toda persistencia fica em `localStorage`, nas chaves:

- `gestec.users`
- `gestec.tickets`
- `gestec.projects`
- `gestec.workflows`
- `gestec.slaRules`
- `gestec.discordRules`
- `gestec.auditLogs`
- `gestec.costCenters`
- `gestec.appConfig`
- `gestec.apiIntegrations`
- `gestec.session`
- `gestec.timers`

O seed inicial inclui usuario admin local, workflow Zeev padrao, regras basicas de SLA, centros de custo basicos e config minima.

## Limitacoes conhecidas

- Local-only: cada navegador/perfil tem sua propria base.
- Sem seguranca de producao: nao ha servidor, cookies seguros ou controle real de segredo no modulo.
- Multi-abas usa comportamento simples de `localStorage`, sem sincronizacao avancada.
- Anexos estao desabilitados nesta fase.
- E-mail, Discord e webhooks sao simulados/no-op com registro em auditoria quando aplicavel.
- Integracoes API armazenam CRUD local das configuracoes; chamadas reais dependem de implementacao em tela e das regras de CORS do destino.

## Sidebar

A sidebar segue o layout shadcn de referencia: topo com logo verde e texto `gestec`, tres links placeholder `Exemplo` para o ecossistema gestec, grupo colapsavel `Gestec Help Desk` com apenas `Tickets`, `Kanban`, `Acompanhar solicitacoes` e `Integracoes`, widget `Cronometros` e usuario no rodape. Saem do menu lateral Projetos, Indicadores, Faturamento, aprovacoes, triagem, atendimento, conclusao, cancelamentos, usuarios, workflows, SLA, Discord e valores; essas telas continuam no router e podem ser acessadas por URLs diretas, deep links e acoes contextuais dentro dos fluxos.
