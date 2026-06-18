import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FolderKanban, Plus, Save, Trash2 } from 'lucide-react'
import type { Project } from '../../../shared/types'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { formatMinutesAsHours, getProjectEstimatedValue, getProjectTotalMinutes } from '@/lib/project'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ProjectFormState {
  name: string
  description: string
  costCenter: string
  hourlyRate: string
}

const EMPTY_FORM: ProjectFormState = {
  name: '',
  description: '',
  costCenter: '',
  hourlyRate: '',
}

function getErrorMessage(error: unknown): string {
  return getIpcErrorMessage(error, {
    overrides: {
      PROJECT_CONFLICT:
        'O projeto foi alterado por outro usuário. Recarregue a lista e tente novamente.',
    },
    fallback: 'Não foi possível concluir a operação.',
  })
}

export default function ProjectListPage(): JSX.Element {
  const user = useAuthStore((state) => state.user)
  const canManage = user?.role === 'manager' || user?.role === 'admin'

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [costCenterFilter, setCostCenterFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [createForm, setCreateForm] = useState<ProjectFormState>(EMPTY_FORM)
  const [editFormById, setEditFormById] = useState<Record<string, ProjectFormState>>({})
  const [isCreating, setIsCreating] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const costCenters = useMemo(
    () => ['all', ...new Set(projects.map((project) => project.costCenter))],
    [projects],
  )

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) =>
        costCenterFilter === 'all' ? true : project.costCenter === costCenterFilter,
      ),
    [projects, costCenterFilter],
  )

  async function loadProjects(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const result = await ipc.listProjects()
      setProjects(result)
      setEditFormById(
        Object.fromEntries(
          result.map((project) => [
            project.id,
            {
              name: project.name,
              description: project.description ?? '',
              costCenter: project.costCenter,
              hourlyRate: String(project.hourlyRate),
            },
          ]),
        ),
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProjects()
  }, [])

  async function handleCreateProject(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!canManage) return

    setError(null)
    setFeedback(null)

    const hourlyRate = Number(createForm.hourlyRate)
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      setError('Informe um valor/hora válido.')
      return
    }

    setIsCreating(true)
    try {
      await ipc.createProject({
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        costCenter: createForm.costCenter.trim(),
        hourlyRate,
      })
      setCreateForm(EMPTY_FORM)
      setShowForm(false)
      setFeedback('Projeto criado com sucesso.')
      await loadProjects()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsCreating(false)
    }
  }

  async function handleUpdateProject(project: Project): Promise<void> {
    if (!canManage) return
    const currentForm = editFormById[project.id]
    if (!currentForm) return

    setError(null)
    setFeedback(null)

    const hourlyRate = Number(currentForm.hourlyRate)
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      setError('Informe um valor/hora válido.')
      return
    }

    setPendingId(project.id)
    try {
      const updated = await ipc.updateProject({
        id: project.id,
        name: currentForm.name.trim(),
        description: currentForm.description.trim() || undefined,
        costCenter: currentForm.costCenter.trim(),
        hourlyRate,
        expectedUpdatedAt: project.updatedAt,
      })
      setProjects((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setFeedback(`Projeto "${updated.name}" atualizado.`)
    } catch (err) {
      setError(getErrorMessage(err))
      await loadProjects()
    } finally {
      setPendingId(null)
    }
  }

  async function handleDeleteProject(project: Project): Promise<void> {
    if (!canManage) return
    const confirmed = window.confirm(
      `Excluir o projeto "${project.name}"? Esta ação não pode ser desfeita.`,
    )
    if (!confirmed) return

    setError(null)
    setFeedback(null)
    setPendingId(project.id)
    try {
      await ipc.deleteProject(project.id)
      setProjects((prev) => prev.filter((item) => item.id !== project.id))
      setFeedback(`Projeto "${project.name}" excluído.`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projetos internos"
        description="Gestão de projetos, tarefas e apontamentos para trabalho interno."
      >
        {canManage ? (
          <Button onClick={() => setShowForm((prev) => !prev)} className="gap-2">
            <Plus className="h-4 w-4" />
            {showForm ? 'Fechar formulário' : 'Novo projeto'}
          </Button>
        ) : null}
      </PageHeader>

      {error ? <StatusAlert variant="error" message={error} /> : null}
      {feedback ? <StatusAlert variant="success" message={feedback} /> : null}

      {showForm && canManage ? (
        <Card className="surface-card animate-in fade-in slide-in-from-top-1 duration-300">
          <CardHeader>
            <CardTitle className="text-lg">Novo projeto</CardTitle>
            <CardDescription>Cadastre um projeto interno para apontamento de horas.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateProject}>
              <div className="space-y-2">
                <Label htmlFor="p-name">Nome do projeto</Label>
                <Input
                  id="p-name"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ex.: Migração de servidores"
                  minLength={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cc">Centro de custo</Label>
                <Input
                  id="p-cc"
                  value={createForm.costCenter}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, costCenter: event.target.value }))
                  }
                  placeholder="Ex.: TI-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-rate">Valor/hora (R$)</Label>
                <Input
                  id="p-rate"
                  value={createForm.hourlyRate}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, hourlyRate: event.target.value }))
                  }
                  placeholder="0,00"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="p-desc">Descrição (opcional)</Label>
                <Textarea
                  id="p-desc"
                  value={createForm.description}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Objetivo e escopo do projeto"
                />
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? 'Criando...' : 'Criar projeto'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="surface-card">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Projetos cadastrados</CardTitle>
            <CardDescription>
              {filteredProjects.length} {filteredProjects.length === 1 ? 'projeto' : 'projetos'}
            </CardDescription>
          </div>
          <Select value={costCenterFilter} onValueChange={setCostCenterFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Centro de custo" />
            </SelectTrigger>
            <SelectContent>
              {costCenters.map((costCenter) => (
                <SelectItem key={costCenter} value={costCenter}>
                  {costCenter === 'all' ? 'Todos os centros de custo' : costCenter}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <InlineLoader rows={3} />
          ) : filteredProjects.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="Nenhum projeto encontrado"
              description="Crie um novo projeto ou ajuste o filtro de centro de custo."
              action={
                canManage && !showForm ? (
                  <Button onClick={() => setShowForm(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Novo projeto
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredProjects.map((project) => {
                const totalMinutes = getProjectTotalMinutes(project)
                const estimatedValue = getProjectEstimatedValue(project)
                const edit = editFormById[project.id] ?? {
                  name: project.name,
                  description: project.description ?? '',
                  costCenter: project.costCenter,
                  hourlyRate: String(project.hourlyRate),
                }
                const busy = pendingId === project.id

                return (
                  <article key={project.id} className="rounded-xl border bg-background p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{project.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          Atualizado em {new Date(project.updatedAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/projects/${project.id}`}>
                            Abrir
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        {canManage ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void handleDeleteProject(project)}
                            disabled={busy}
                            aria-label="Excluir projeto"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{project.costCenter}</Badge>
                      <Badge variant="secondary">{project.tasks.length} tarefas</Badge>
                      <Badge variant="secondary">{formatMinutesAsHours(totalMinutes)}h</Badge>
                      <Badge variant="secondary">R$ {estimatedValue.toFixed(2)}</Badge>
                    </div>

                    {project.description ? (
                      <p className="mb-3 whitespace-pre-wrap text-sm text-muted-foreground">
                        {project.description}
                      </p>
                    ) : null}

                    {canManage ? (
                      <div className="grid gap-3 border-t pt-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs" htmlFor={`edit-name-${project.id}`}>
                            Nome
                          </Label>
                          <Input
                            id={`edit-name-${project.id}`}
                            value={edit.name}
                            onChange={(event) =>
                              setEditFormById((prev) => ({
                                ...prev,
                                [project.id]: { ...edit, name: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs" htmlFor={`edit-cc-${project.id}`}>
                            Centro de custo
                          </Label>
                          <Input
                            id={`edit-cc-${project.id}`}
                            value={edit.costCenter}
                            onChange={(event) =>
                              setEditFormById((prev) => ({
                                ...prev,
                                [project.id]: { ...edit, costCenter: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs" htmlFor={`edit-rate-${project.id}`}>
                            Valor/hora (R$)
                          </Label>
                          <Input
                            id={`edit-rate-${project.id}`}
                            value={edit.hourlyRate}
                            onChange={(event) =>
                              setEditFormById((prev) => ({
                                ...prev,
                                [project.id]: { ...edit, hourlyRate: event.target.value },
                              }))
                            }
                            type="number"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            onClick={() => void handleUpdateProject(project)}
                            disabled={busy}
                            variant="secondary"
                            className="w-full gap-2"
                          >
                            <Save className="h-4 w-4" />
                            {busy ? 'Salvando...' : 'Salvar'}
                          </Button>
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label className="text-xs" htmlFor={`edit-desc-${project.id}`}>
                            Descrição
                          </Label>
                          <Textarea
                            id={`edit-desc-${project.id}`}
                            value={edit.description}
                            onChange={(event) =>
                              setEditFormById((prev) => ({
                                ...prev,
                                [project.id]: { ...edit, description: event.target.value },
                              }))
                            }
                            placeholder="Descrição do projeto"
                          />
                        </div>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
