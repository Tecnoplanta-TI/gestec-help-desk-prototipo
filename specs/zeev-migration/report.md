# Relatório de Revisão Arquitetural — Migração Zeev

**Data:** 2026-06-17  
**Resultado:** ⚠️ Aprovado com ajustes

## Checklist

### Segurança (Electron)
- [x] Renderer via IPC tipado — proposta mantida
- [x] RBAC expandido via permissions
- [x] Secrets SMTP/Discord no Main only
- [ ] ⚠️ Implementar filtro solicitante só próprios tickets
- [ ] ⚠️ Implementar filtro atendente só atribuídos

### Arquitetura de camadas
- [x] form-rules puro em shared/lib
- [x] approval, email, audit como serviços dedicados
- [x] Seed workflow separado de CRUD admin
- [ ] ⚠️ Contrato ElectronAPI precisa extensão major
- [ ] ⚠️ preload.ts expor novos métodos

### Banco de dados (Cosmos)
- [x] Embutir tasks, cancellationItems, comments no Ticket
- [x] AuditLog container append-only
- [x] CostCenter container
- [ ] ⚠️ Migration script tickets existentes (campos default)

### Workflow
- [x] Step IDs estáveis documentados
- [x] Roteamento pós-criação por type
- [ ] ⚠️ Transições automáticas open → destino
- [ ] ⚠️ Permission check por transição

### Integração externa
- [x] Webhook Zeev marcado descontinuado
- [x] platform-integration arquivado
- [x] Sem outbound Zeev

### UI
- [x] Novas rotas documentadas
- [x] DynamicTicketForm desacoplado
- [ ] ⚠️ RootLayout nav condicional por permission

## Pontos de atenção

### ⚠️ Breaking change em CreateTicketPayload
**Problema:** Payload atual é mínimo; Zeev exige ~15 campos condicionais.  
**Solução:** Estender payload; manter compat backward com defaults.

### ⚠️ Workflow default existente vs Zeev
**Problema:** Instalações com workflow custom perdem seed.  
**Solução:** `ensureZeevDefaultWorkflow` só se nenhum default; admin pode importar template.

### ⚠️ E-mail sem infra SMTP em dev
**Problema:** Dev não tem SMTP.  
**Solução:** `emailEnabled: false` + log to console/NotificationLog.

## Decisão final

**Aprovado com ajustes** — spec coerente com arquitetura Electron + Cosmos. Implementar Fases B–G sequencialmente; validar validation-points antes de ativar job 7 dias.

**Próximo passo:** Fase B — tipos + formulário dinâmico.
