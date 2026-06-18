import { FormEvent, useEffect, useMemo, useState } from 'react'
import { GitBranch, Plus, ShieldAlert, Star, Trash2, X } from 'lucide-react'
import type {
  CreateWorkflowPayload,
  Workflow,
  WorkflowCondition,
  WorkflowStepType,
  WorkflowTransitionInput,
} from '../../../shared/types'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { EmptyState } from '@/components/shared/EmptyState'
import { InlineLoader } from '@/components/shared/PageLoader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type WorkflowConditionOperator = WorkflowCondition['operator']

type WorkflowFormStep = {
  id: string
  name: string
  type: WorkflowStepType
  defaultAssigneeId: string
  slaHours: string
}

type WorkflowFormTransition = {
  id: string
  fromStepId: string
  toStepId: string
  field: string
  operator: WorkflowConditionOperator
  value: string
}

const NO_CONDITION = '__none__'
const CONDITION_FIELDS = ['type', 'priority', 'serviceGroup']

const STEP_TYPE_LABEL: Record<WorkflowStepType, string> = {
  manual: 'Manual',
  approval: 'Aprovação',
  automatic: 'Automática',
}

const OPERATOR_LABEL: Record<WorkflowConditionOperator, string> = {
  equal: 'igual a',
  not_equal: 'diferente de',
  in: 'está na lista',
  not_in: 'não está na lista',
}

function createId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function parseError(error: unknown): string {
  return getIpcErrorMessage(error, {
    overrides: {
      FORBIDDEN: 'Apenas administradores podem gerenciar workflows.',
      INVALID_INPUT: 'Dados inválidos. Revise etapas e transições.',
      WORKFLOW_LAST_DELETE_FORBIDDEN: 'Não é possível remover o último workflow.',
      WORKFLOW_DEFAULT_REQUIRED: 'É obrigatório manter um workflow padrão.',
      WORKFLOW_NOT_FOUND: 'Workflow não encontrado.',
    },
    fallback: 'Não foi possível concluir a operação.',
  })
}

function createEmptyStep(order: number): WorkflowFormStep {
  return { id: createId(), name: `Etapa ${order}`, type: 'manual', defaultAssigneeId: '', slaHours: '' }
}

function createEmptyTransition(): WorkflowFormTransition {
  return { id: createId(), fromStepId: '', toStepId: '', field: '', operator: 'equal', value: '' }
}

function mapWorkflowToForm(workflow: Workflow): {
  name: string
  description: string
  isDefault: boolean
  steps: WorkflowFormStep[]
  transitions: WorkflowFormTransition[]
} {
  return {
    name: workflow.name,
    description: workflow.description ?? '',
    isDefault: workflow.isDefault,
    steps: [...workflow.steps]
      .sort((a, b) => a.order - b.order)
      .map((step) => ({
        id: step.id,
        name: step.name,
        type: step.type,
        defaultAssigneeId: step.defaultAssigneeId ?? '',
        slaHours: step.slaHours?.toString() ?? '',
      })),
    transitions: workflow.transitions.map((transition) => {
      const firstCondition = transition.conditions[0]
      return {
        id: transition.id,
        fromStepId: transition.fromStepId,
        toStepId: transition.toStepId,
        field: firstCondition?.field ?? '',
        operator: firstCondition?.operator ?? 'equal',
        value: Array.isArray(firstCondition?.value)
          ? firstCondition.value.join(', ')
          : firstCondition?.value ?? '',
      }
    }),
  }
}

function buildTransitionInput(transition: WorkflowFormTransition): WorkflowTransitionInput {
  const hasCondition = transition.field.trim().length > 0 && transition.value.trim().length > 0
  if (!hasCondition) {
    return {
      id: transition.id,
      fromStepId: transition.fromStepId,
      toStepId: transition.toStepId,
      conditions: [],
    }
  }

  const normalizedValue = transition.value.trim()
  const parsedValue =
    transition.operator === 'in' || transition.operator === 'not_in'
      ? normalizedValue
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : normalizedValue

  return {
    id: transition.id,
    fromStepId: transition.fromStepId,
    toStepId: transition.toStepId,
    conditions: [{ field: transition.field, operator: transition.operator, value: parsedValue }],
  }
}

function hasBrokenTransition(
  steps: WorkflowFormStep[],
  transitions: WorkflowFormTransition[],
): boolean {
  const ids = new Set(steps.map((step) => step.id))
  return transitions.some(
    (transition) => !ids.has(transition.fromStepId) || !ids.has(transition.toStepId),
  )
}

export default function WorkflowsPage(): JSX.Element {
  const currentUser = useAuthStore((state) => state.user)

  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [steps, setSteps] = useState<WorkflowFormStep[]>([createEmptyStep(1)])
  const [transitions, setTransitions] = useState<WorkflowFormTransition[]>([])

  const stepOptions = useMemo(
    () =>
      steps.map((step, index) => ({
        id: step.id,
        label: `${index + 1}. ${step.name || 'Sem nome'}`,
      })),
    [steps],
  )

  async function loadWorkflows(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const result = await ipc.listWorkflows()
      setWorkflows(result)
    } catch (err) {
      setError(parseError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadWorkflows()
  }, [])

  function resetForm(): void {
    setEditingId(null)
    setName('')
    setDescription('')
    setIsDefault(false)
    setSteps([createEmptyStep(1)])
    setTransitions([])
  }

  function loadWorkflowIntoForm(workflow: Workflow): void {
    const mapped = mapWorkflowToForm(workflow)
    setEditingId(workflow.id)
    setName(mapped.name)
    setDescription(mapped.description)
    setIsDefault(mapped.isDefault)
    setSteps(mapped.steps)
    setTransitions(mapped.transitions)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setFeedback(null)

    if (steps.length === 0) {
      setError('Adicione ao menos uma etapa.')
      return
    }

    if (hasBrokenTransition(steps, transitions)) {
      setError('Existem transições apontando para etapas removidas.')
      return
    }

    const invalidSla = steps.some((step) => {
      if (!step.slaHours.trim()) return false
      const value = Number(step.slaHours)
      return !Number.isFinite(value) || value < 1
    })
    if (invalidSla) {
      setError('Informe um SLA válido (em horas, mínimo 1) nas etapas que o utilizam.')
      return
    }

    const payload: CreateWorkflowPayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      isDefault,
      steps: steps.map((step, index) => ({
        id: step.id,
        name: step.name.trim(),
        type: step.type,
        defaultAssigneeId: step.defaultAssigneeId.trim() || undefined,
        slaHours: step.slaHours ? Number(step.slaHours) : undefined,
        order: index + 1,
      })),
      transitions: transitions.map(buildTransitionInput),
    }

    try {
      if (editingId) {
        await ipc.updateWorkflow({ id: editingId, ...payload })
        setFeedback('Workflow atualizado com sucesso.')
      } else {
        await ipc.createWorkflow(payload)
        setFeedback('Workflow criado com sucesso.')
      }
      resetForm()
      await loadWorkflows()
    } catch (err) {
      setError(parseError(err))
    }
  }

  async function handleDelete(workflowId: string): Promise<void> {
    setError(null)
    setFeedback(null)
    try {
      await ipc.deleteWorkflow(workflowId)
      if (editingId === workflowId) {
        resetForm()
      }
      setFeedback('Workflow removido com sucesso.')
      await loadWorkflows()
    } catch (err) {
      setError(parseError(err))
    }
  }

  async function handleSetDefault(workflowId: string): Promise<void> {
    setError(null)
    setFeedback(null)
    try {
      await ipc.setDefaultWorkflow(workflowId)
      setFeedback('Workflow padrão atualizado.')
      await loadWorkflows()
    } catch (err) {
      setError(parseError(err))
    }
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Workflows"
          description="Configure etapas, transições e condições de roteamento dos tickets."
        />
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito"
          description="Apenas administradores podem gerenciar workflows."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        description="Configure etapas, transições e condições de roteamento dos tickets."
      />

      {error ? <StatusAlert variant="error" message={error} /> : null}
      {feedback ? <StatusAlert variant="success" message={feedback} /> : null}

      <Card className="surface-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            {editingId ? 'Editar workflow' : 'Novo workflow'}
          </CardTitle>
          {editingId ? (
            <Button variant="outline" size="sm" onClick={resetForm}>
              Cancelar edição
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wf-name">Nome do workflow</Label>
                <Input
                  id="wf-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Suporte padrão"
                  minLength={2}
                  required
                />
              </div>
              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  Definir como workflow padrão
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wf-desc">Descrição (opcional)</Label>
              <Textarea
                id="wf-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o objetivo deste workflow"
              />
            </div>

            {/* Etapas */}
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium">Etapas</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setSteps((prev) => [...prev, createEmptyStep(prev.length + 1)])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar etapa
                </Button>
              </div>

              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="grid items-end gap-2 rounded-md border p-2 md:grid-cols-[1.4fr_1fr_1.2fr_0.9fr_auto]"
                  >
                    <Input
                      value={step.name}
                      onChange={(e) =>
                        setSteps((prev) =>
                          prev.map((item) =>
                            item.id === step.id ? { ...item, name: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder={`Etapa ${index + 1}`}
                      required
                    />
                    <Select
                      value={step.type}
                      onValueChange={(value) =>
                        setSteps((prev) =>
                          prev.map((item) =>
                            item.id === step.id
                              ? { ...item, type: value as WorkflowStepType }
                              : item,
                          ),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STEP_TYPE_LABEL) as WorkflowStepType[]).map((type) => (
                          <SelectItem key={type} value={type}>
                            {STEP_TYPE_LABEL[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={step.defaultAssigneeId}
                      onChange={(e) =>
                        setSteps((prev) =>
                          prev.map((item) =>
                            item.id === step.id
                              ? { ...item, defaultAssigneeId: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Responsável (ID)"
                    />
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={step.slaHours}
                      onChange={(e) =>
                        setSteps((prev) =>
                          prev.map((item) =>
                            item.id === step.id ? { ...item, slaHours: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="SLA (h)"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover etapa"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setSteps((prev) => prev.filter((item) => item.id !== step.id))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Transições */}
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium">Transições</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setTransitions((prev) => [...prev, createEmptyTransition()])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar transição
                </Button>
              </div>

              {transitions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sem transições. O workflow pode ficar bloqueado.
                </p>
              ) : (
                <div className="space-y-2">
                  {transitions.map((transition) => (
                    <div
                      key={transition.id}
                      className="grid items-end gap-2 rounded-md border p-2 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]"
                    >
                      <Select
                        value={transition.fromStepId || undefined}
                        onValueChange={(value) =>
                          setTransitions((prev) =>
                            prev.map((item) =>
                              item.id === transition.id ? { ...item, fromStepId: value } : item,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Origem" />
                        </SelectTrigger>
                        <SelectContent>
                          {stepOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={transition.toStepId || undefined}
                        onValueChange={(value) =>
                          setTransitions((prev) =>
                            prev.map((item) =>
                              item.id === transition.id ? { ...item, toStepId: value } : item,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Destino" />
                        </SelectTrigger>
                        <SelectContent>
                          {stepOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={transition.field || NO_CONDITION}
                        onValueChange={(value) =>
                          setTransitions((prev) =>
                            prev.map((item) =>
                              item.id === transition.id
                                ? { ...item, field: value === NO_CONDITION ? '' : value }
                                : item,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_CONDITION}>Sem condição</SelectItem>
                          {CONDITION_FIELDS.map((field) => (
                            <SelectItem key={field} value={field}>
                              {field}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={transition.operator}
                        onValueChange={(value) =>
                          setTransitions((prev) =>
                            prev.map((item) =>
                              item.id === transition.id
                                ? { ...item, operator: value as WorkflowConditionOperator }
                                : item,
                            ),
                          )
                        }
                        disabled={!transition.field}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(OPERATOR_LABEL) as WorkflowConditionOperator[]).map(
                            (operator) => (
                              <SelectItem key={operator} value={operator}>
                                {OPERATOR_LABEL[operator]}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>

                      <Input
                        value={transition.value}
                        onChange={(e) =>
                          setTransitions((prev) =>
                            prev.map((item) =>
                              item.id === transition.id ? { ...item, value: e.target.value } : item,
                            ),
                          )
                        }
                        placeholder="Valor (vírgula p/ lista)"
                        disabled={!transition.field}
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover transição"
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                          setTransitions((prev) => prev.filter((item) => item.id !== transition.id))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit">{editingId ? 'Salvar workflow' : 'Criar workflow'}</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-base">Workflows cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <InlineLoader rows={3} />
          ) : workflows.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="Nenhum workflow cadastrado"
              description="Crie o primeiro workflow para rotear os tickets."
            />
          ) : (
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <div key={workflow.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{workflow.name}</p>
                        {workflow.isDefault ? (
                          <Badge className="gap-1">
                            <Star className="h-3 w-3" />
                            Padrão
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {workflow.description || 'Sem descrição'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{workflow.steps.length} etapas</Badge>
                        <Badge variant="secondary">{workflow.transitions.length} transições</Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadWorkflowIntoForm(workflow)}
                      >
                        Editar
                      </Button>
                      {!workflow.isDefault ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => void handleSetDefault(workflow.id)}
                        >
                          <Star className="h-3.5 w-3.5" />
                          Tornar padrão
                        </Button>
                      ) : null}
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Excluir workflow"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void handleDelete(workflow.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
