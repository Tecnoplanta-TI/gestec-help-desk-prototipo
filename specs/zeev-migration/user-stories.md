# Histórias de Usuário — Migração Zeev

**Formato:** Given / When / Then

---

## US01 — Solicitante abre ticket incidente

**Como** solicitante, **quero** abrir um incidente com prioridade e grupo de serviços, **para** reportar um problema operacional.

- **Given** estou autenticado como solicitante
- **When** seleciono tipo Incidente, P2, grupo Gestec e descrevo o problema
- **Then** o ticket é criado com número único e aparece em "Meus tickets" com status Em triagem

---

## US02 — Solicitante abre melhoria

**Como** solicitante, **quero** abrir melhoria com ciência dos critérios, **para** seguir o fluxo de aprovação correto.

- **Given** estou no formulário de nova solicitação
- **When** seleciono Melhoria, marco ciência, informo gestor app e envio
- **Then** status fica Aguardando Gestor TI e gestores TI são notificados

---

## US03 — Solicitante abre interrupção de serviço

**Como** solicitante, **quero** informar serviço e tempo de indisponibilidade, **para** priorizar restauração.

- **Given** tipo Interrupção de serviço selecionado
- **When** escolho Serviço=Sistema, Sistema indisponível=Siger e informo 45 minutos
- **Then** ticket criado com campos persistidos e notificação Discord P{n}

---

## US04 — Solicitante solicita cancelamento Zeev

**Como** solicitante, **quero** listar solicitações Zeev a cancelar, **para** encerrar processos obsoletos.

- **Given** tipo Cancelamento selecionado
- **When** adiciono 2 linhas com números e justificativas e envio
- **Then** ticket segue para aprovação de cancelamento ou conclusão direta

---

## US05 — Gestor TI aprova melhoria

**Como** gestor TI, **quero** aprovar melhorias válidas, **para** encaminhar ao gestor do aplicativo.

- **Given** ticket em Aguardando Gestor TI
- **When** clico Aprovar
- **Then** status muda para Aguardando Gestor App

---

## US06 — Gestor TI recusa melhoria

**Como** gestor TI, **quero** recusar com justificativa, **para** informar o solicitante.

- **Given** ticket em Aguardando Gestor TI
- **When** recuso informando motivo
- **Then** ticket encerra como recusado TI e solicitante recebe e-mail

---

## US07 — Gestor App aprova melhoria

**Como** gestor do aplicativo, **quero** aprovar após validação funcional, **para** liberar triagem.

- **Given** ticket aprovado pelo TI
- **When** aprovo como gestor app
- **Then** ticket vai para triagem

---

## US08 — Triador aprova para atendimento

**Como** responsável triagem, **quero** atribuir atendente, **para** iniciar SLA de atendimento.

- **Given** ticket em triagem
- **When** seleciono atendente e aprovo
- **Then** ticket fica Aguardando atendimento e atendente é notificado

---

## US09 — Triador solicita ajuste

**Como** triador, **quero** devolver ao solicitante, **para** obter informações faltantes.

- **Given** ticket incompleto
- **When** solicito ajuste com comentário
- **Then** solicitante pode editar e reenviar

---

## US10 — Atendente inicia atendimento

**Como** atendente, **quero** iniciar ticket atribuído, **para** registrar início formal.

- **Given** ticket na minha fila
- **When** clico Iniciar atendimento
- **Then** status Em atendimento e solicitante notificado

---

## US11 — Atendente registra apontamento

**Como** atendente, **quero** lançar horas manualmente, **para** compor relatório de tempo.

- **Given** ticket em atendimento
- **When** informo 09:00–10:30 com descrição
- **Then** apontamento salvo com 90 minutos calculados

---

## US12 — Atendente conclui ticket

**Como** atendente, **quero** marcar como resolvido, **para** solicitar avaliação.

- **Given** ticket em atendimento
- **When** concluo atendimento
- **Then** status Aguardando avaliação

---

## US13 — Solicitante avalia serviço

**Como** solicitante, **quero** dar nota e feedback, **para** medir qualidade.

- **Given** ticket aguardando avaliação
- **When** informo nota 8 e expectativa atendida=Sim
- **Then** ticket Concluído e métricas atualizadas

---

## US14 — Avaliação baixa exige justificativa

**Como** solicitante insatisfeito, **quero** explicar nota baixa, **para** a TI entender causas.

- **Given** formulário de avaliação
- **When** dou nota 4
- **Then** campo Justificativa NPS torna-se obrigatório

---

## US15 — Admin configura centros de custo

**Como** admin, **quero** cadastrar centros de custo, **para** padronizar abertura.

- **Given** painel admin
- **When** cadastro código 47 e nome
- **Then** centro aparece no select de abertura

---

## US16 — Admin configura limiar NPS

**Como** admin, **quero** definir nota mínima para justificativa, **para** alinhar política de qualidade.

- **Given** configurações do app
- **When** altero limiar de 6 para 7
- **Then** formulário de avaliação usa novo limiar

---

## US17 — Cancelamento aprovado direto

**Como** usuário autorizado, **quero** aprovar cancelamento sem gestor, **para** agilizar casos simples.

- **Given** permissão `cancellation_direct_approve`
- **When** marco aprovar direto e envio
- **Then** ticket conclui sem etapa de aprovação

---

## US18 — Solicitante acompanha timeline

**Como** solicitante, **quero** ver histórico do ticket, **para** entender andamento.

- **Given** ticket existente
- **When** abro detalhe
- **Then** vejo timeline com status, aprovações e comentários públicos
