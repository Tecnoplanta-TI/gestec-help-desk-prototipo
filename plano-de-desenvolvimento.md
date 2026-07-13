# Plano de desenvolvimento

O gestec help desk agora e uma SPA React frontend-only. A persistencia e local, usando `localStorage`, e a camada de dados publica o contrato de `shared/types` por meio de `src/lib/local-api.ts`.

## Arquitetura atual

- React 19 + Vite.
- React Router com `BrowserRouter`.
- UI e stores em `src/`.
- Tipos e regras portaveis em `shared/`.
- Persistencia local namespaced em chaves `gestec.*`.
- Sem backend, processo desktop, servidor interno ou banco remoto.

## Prioridades

- Manter os fluxos principais offline: tickets, triagem, atendimento, aprovacao de conclusao, projetos, usuarios, workflows e SLA.
- Evoluir validacoes Zod no cliente conforme os formularios crescerem.
- Manter mocks explicitos para e-mail, Discord, webhooks e anexos.
- Evitar dependencias de infraestrutura que reintroduzam backend escondido.
