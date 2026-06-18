# Skill: spec-creator

## Quando usar
Use esta skill quando o usuário solicitar o desenvolvimento de uma nova feature,
módulo ou alteração significativa na aplicação **gestec · help desk**.
Execute ANTES de qualquer código ser escrito.

## Regra obrigatória de versionamento
Após concluir o desenvolvimento de qualquer spec aprovada, deve ser realizado
um commit Git imediatamente (sem acumular múltiplas specs no mesmo commit),
seguindo Conventional Commits e com escopo da spec/fase.

## Objetivo
Conduzir uma entrevista estruturada, coletar todos os requisitos e gerar
um documento Spec padronizado em `specs/[feature]/spec.md`, garantindo
que nenhum detalhe importante seja esquecido antes do desenvolvimento.

## Fluxo de execução

### 1. Identificação
Pergunte ao usuário:
- Qual é o nome da feature? (ex: "cronômetro de tickets")
- Qual problema ela resolve?
- Quais usuários são impactados? (membro / gestor / admin / todos)

### 2. Requisitos funcionais
Pergunte:
- Quais são os casos de uso principais? (liste cada ação que o usuário pode realizar)
- Há casos de uso secundários ou opcionais?
- Existem edge cases conhecidos? (ex: "e se o cronômetro ficar rodando e o app for fechado?")
- Há restrições de negócio? (ex: "apenas admin pode deletar")

### 3. Integrações e impacto
Pergunte:
- Esta feature afeta outros módulos existentes? (tickets, projetos, auth, etc.)
- Requer integração com serviços externos? (plataforma externa, Discord, Azure)
- Altera o modelo de dados? (novos campos, novos containers Cosmos DB)

### 4. Critérios de aceite
Pergunte:
- Como saberemos que a feature está funcionando corretamente?
- Quais cenários devem ser testados manualmente?
- Há requisitos de performance ou segurança específicos?

### 5. Geração do Spec
Após coletar todas as informações, crie os seguintes arquivos:

#### `specs/[feature-slug]/spec.md`
```markdown
# Spec: [Nome da Feature]

**Status:** draft | review | approved | done
**Data:** YYYY-MM-DD
**Fase do roadmap:** Fase N — [nome]

## Contexto
[Problema que a feature resolve e por que é necessária]

## Requisitos Funcionais
- RF01: [descrição]
- RF02: [descrição]
...

## Requisitos Não-funcionais
- RNF01: [ex: operação deve completar em < 200ms]
- RNF02: [ex: sem exposição de secrets no Renderer]
...

## Casos de Uso
### UC01 — [nome]
**Ator:** [membro | gestor | admin]
**Fluxo principal:**
1. ...
2. ...
**Fluxo alternativo / exceção:**
- ...

## Modelo de Dados Afetado
[Descreva campos novos ou alterados em shared/types/index.ts e Cosmos DB]

## Critérios de Aceite
- [ ] CA01: [cenário + resultado esperado]
- [ ] CA02: ...

## Dependências
- Requer: [outras specs ou fases concluídas]
- Afeta: [módulos ou arquivos que precisam ser revisados]

## Notas de implementação
[Decisões técnicas, bibliotecas sugeridas, padrões a seguir]
```

#### `specs/[feature-slug]/decisions.md`
```markdown
# Decisões de Design — [Nome da Feature]

| # | Decisão | Alternativa considerada | Justificativa |
|---|---------|------------------------|---------------|
| 1 | ...     | ...                    | ...           |
```

#### Atualizar `specs/index.md`
Adicionar linha na tabela de specs:
```markdown
| [Nome] | specs/[slug]/spec.md | draft | Fase N |
```

### 6. Próximo passo
Após criar os arquivos, informe ao usuário:
> "Spec criada em `specs/[slug]/spec.md`. Execute a skill **arch-review** antes de iniciar o desenvolvimento."

### 7. Pós-desenvolvimento da spec (obrigatório)
Quando a spec estiver implementada e validada:
1. Atualize status da spec (`approved` -> `in_progress` -> `done`, conforme etapa atual)
2. Realize commit Git imediatamente com Conventional Commit
3. Informe o hash do commit ao usuário
