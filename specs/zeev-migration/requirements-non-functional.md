# Requisitos Não Funcionais — Migração Zeev

**Data:** 2026-06-17

| ID | Categoria | Requisito |
|----|-----------|-----------|
| RNF001 | Segurança | Senhas bcrypt cost ≥ 10 |
| RNF002 | Segurança | JWT com expiração configurável |
| RNF003 | AuthZ | RBAC via `permissions[]` + role legacy |
| RNF004 | AuthZ | Controle por etapa do workflow |
| RNF005 | Arquitetura | Renderer nunca acessa Cosmos |
| RNF006 | Validação | Zod em todo payload IPC |
| RNF007 | Anexos | Máx 10MB/arquivo |
| RNF008 | Anexos | MIME whitelist configurável |
| RNF009 | Storage | Blob Azure chave opaca |
| RNF010 | LGPD | Dados mínimos; retenção configurável |
| RNF011 | Auditoria | AuditLog append-only |
| RNF012 | Performance | Listagem 5k tickets < 2s |
| RNF013 | UX | Min viewport 1024px |
| RNF014 | A11y | shadcn + ARIA |
| RNF015 | i18n | pt-BR |
| RNF016 | Observabilidade | Logs estruturados JSON no Main |
| RNF017 | Disponibilidade | Cosmos backup Azure |
| RNF018 | Integridade | Transições workflow atômicas |
| RNF019 | Integridade | Optimistic lock via `updatedAt` |
| RNF020 | E-mail | Falha não bloqueia fluxo ticket |
| RNF021 | Discord | Falha não bloqueia fluxo ticket |
| RNF022 | Escalabilidade | Partition por id em tickets |
| RNF023 | Manutenibilidade | Regras formulário em módulo puro |
| RNF024 | Manutenibilidade | Serviços < 500 LOC por domínio |
| RNF025 | Testabilidade | form-rules e workflow testáveis sem Electron |
| RNF026 | Segurança | Secrets SMTP apenas Main Process |
| RNF027 | Segurança | Solicitante só vê próprios tickets |
| RNF028 | Segurança | Atendente só tickets atribuídos |
| RNF029 | Backup | Export audit logs admin |
| RNF030 | Compliance | Registro decisões aprovação imutável |

## Segurança — detalhamento

- IPC handlers validam sessão em toda operação mutável
- Upload valida magic bytes além de MIME declarado (*sugestão*)
- Rate limit webhook descontinuado; API interna apenas localhost

## Performance — detalhamento

- Filas (triagem, atendimento) filtram in-memory pós-fetch (*MVP*); índice Cosmos futuro
- Paginação listagem tickets (*sugestão fase G*)

## LGPD

- Solicitante: nome, e-mail, CC
- Direito de acesso via export ticket (*futuro*)
- Anonimização pós-retention (*futuro*)
