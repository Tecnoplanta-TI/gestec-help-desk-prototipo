import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  ListTodo,
  Paperclip,
  Plus,
  Receipt,
  Trash2,
  Upload,
} from 'lucide-react'
import type { AttachmentFile, Expense, Project, ProjectTask } from '../../../shared/types'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { fileToBase64 } from '@/lib/files'
import {
  formatMinutesAsHours,
  getProjectEstimatedValue,
  getProjectTotalMinutes,
  getTaskTotalMinutes,
} from '@/lib/project'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { EmptyState } from '@/components/shared/EmptyState'
import { InlineLoader } from '@/components/shared/PageLoader'
import { ExpenseReceiptDialog } from '@/components/shared/ExpenseReceiptDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TaskDraft {
  title: string
  description: string
  assigneeId: string
}

interface AppointmentDraft {
  date: string
  startTime: string
  endTime: string
  totalMinutes: string
  note: string
}

const EMPTY_TASK: TaskDraft = { title: '', description: '', assigneeId: '' }
const EMPTY_APPOINTMENT: AppointmentDraft = {
  date: '',
  startTime: '',
  endTime: '',
  totalMinutes: '',
  note: '',
}

function parseError(error: unknown): string {
  return getIpcErrorMessage(error, {
    overrides: {
      PROJECT_TASK_NOT_FOUND: 'Tarefa não encontrada.',
      PROJECT_TASK_APPOINTMENT_NOT_FOUND: 'Apontamento não encontrado.',
      PROJECT_CONFLICT:
        'O projeto foi alterado por outro usuário. Recarregue e tente novamente.',
    },
    fallback: 'Não foi possível concluir a operação.',
  })
}

export default function ProjectDetailPage(): JSX.Element {
  const { id } = useParams()
  const user = useAuthStore((state) => state.user)
  const canManage = user?.role === 'manager' || user?.role === 'admin'

  const [project, setProject] = useState<Project | null>(null)
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(EMPTY_TASK)
  const [appointmentDraftByTask, setAppointmentDraftByTask] = useState<
    Record<string, AppointmentDraft>
  >({})
  const [appointmentEditKey, setAppointmentEditKey] = useState<string | null>(null)
  const [appointmentEditDraft, setAppointmentEditDraft] = useState<AppointmentDraft>(EMPTY_APPOINTMENT)
  const [taskEditDraftById, setTaskEditDraftById] = useState<Record<string, TaskDraft>>({})
  const [projectExpenseDescription, setProjectExpenseDescription] = useState('')
  const [projectExpenseSupplier, setProjectExpenseSupplier] = useState('')
  const [projectExpenseQuantity, setProjectExpenseQuantity] = useState('1')
  const [projectExpenseUnitValue, setProjectExpenseUnitValue] = useState('0')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const totals = useMemo(() => {
    if (!project) return { totalMinutes: 0, estimatedValue: 0 }
    return {
      totalMinutes: getProjectTotalMinutes(project),
      estimatedValue: getProjectEstimatedValue(project),
    }
  }, [project])

  const selectedExpense = useMemo((): Expense | null => {
    if (!project || !selectedExpenseId) return null
    return (project.expenses ?? []).find((e) => e.id === selectedExpenseId) ?? null
  }, [project, selectedExpenseId])

  async function loadProject(): Promise<void> {
    if (!id) {
      setLoading(false)
      setError('Projeto inválido: identificador ausente.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await ipc.getProjectById(id)
      setProject(result)
      setTaskEditDraftById(
        Object.fromEntries(
          result.tasks.map((task) => [
            task.id,
            {
              title: task.title,
              description: task.description ?? '',
              assigneeId: task.assigneeId ?? '',
            },
          ]),
        ),
      )
      setAppointmentDraftByTask(
        Object.fromEntries(result.tasks.map((task) => [task.id, { ...EMPTY_APPOINTMENT }])),
      )
    } catch (err) {
      setError(parseError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProject()
  }, [id])

  async function runAction(action: () => Promise<void>, successMessage: string): Promise<void> {
    setError(null)
    setFeedback(null)
    setBusy(true)
    try {
      await action()
      setFeedback(successMessage)
    } catch (err) {
      setError(parseError(err))
    } finally {
      setBusy(false)
    }
  }

  async function runAttachmentAction(
    action: () => Promise<void>,
    successMessage: string,
  ): Promise<void> {
    setError(null)
    setFeedback(null)
    setAttachmentBusy(true)
    try {
      await action()
      setFeedback(successMessage)
    } catch (err) {
      setError(parseError(err))
    } finally {
      setAttachmentBusy(false)
    }
  }

  async function openAttachment(attachment: AttachmentFile): Promise<void> {
    try {
      const url = await ipc.getAttachmentDownloadUrl({ blobKey: attachment.blobKey })
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(parseError(err))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={project?.name ?? 'Detalhe do projeto'}
        description={project?.description || 'Gestão de tarefas, apontamentos e despesas do projeto.'}
      >
        <Button variant="outline" asChild>
          <Link to="/projects">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      {error ? <StatusAlert variant="error" message={error} /> : null}
      {feedback ? <StatusAlert variant="success" message={feedback} /> : null}

      {loading ? (
        <InlineLoader rows={4} />
      ) : !project ? (
        <EmptyState
          icon={FileText}
          title="Projeto não encontrado"
          description="O projeto solicitado não existe ou foi removido."
          action={
            <Button variant="outline" asChild>
              <Link to="/projects">Voltar para a lista</Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* Resumo */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="surface-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Centro de custo</p>
                <p className="mt-1 text-lg font-semibold">{project.costCenter}</p>
              </CardContent>
            </Card>
            <Card className="surface-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Valor/hora</p>
                <p className="mt-1 text-lg font-semibold">R$ {project.hourlyRate.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="surface-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Horas totais</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatMinutesAsHours(totals.totalMinutes)}h
                </p>
              </CardContent>
            </Card>
            <Card className="surface-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Valor estimado</p>
                <p className="mt-1 text-lg font-semibold">R$ {totals.estimatedValue.toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Despesas */}
          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                Despesas do projeto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pe-desc">Descrição</Label>
                  <Input
                    id="pe-desc"
                    value={projectExpenseDescription}
                    onChange={(e) => setProjectExpenseDescription(e.target.value)}
                    placeholder="Descrição da despesa"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pe-supplier">Fornecedor (opcional)</Label>
                  <Input
                    id="pe-supplier"
                    value={projectExpenseSupplier}
                    onChange={(e) => setProjectExpenseSupplier(e.target.value)}
                    placeholder="Nome do fornecedor"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pe-qty">Quantidade</Label>
                  <Input
                    id="pe-qty"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={projectExpenseQuantity}
                    onChange={(e) => setProjectExpenseQuantity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pe-unit">Valor unitário (R$)</Label>
                  <Input
                    id="pe-unit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={projectExpenseUnitValue}
                    onChange={(e) => setProjectExpenseUnitValue(e.target.value)}
                  />
                </div>
              </div>
              <Button
                variant="secondary"
                className="gap-2"
                disabled={busy || !projectExpenseDescription.trim()}
                onClick={() => {
                  const quantity = Number(projectExpenseQuantity)
                  const unitValue = Number(projectExpenseUnitValue)
                  if (!Number.isFinite(quantity) || quantity <= 0) {
                    setError('Informe uma quantidade válida (maior que zero).')
                    return
                  }
                  if (!Number.isFinite(unitValue) || unitValue < 0) {
                    setError('Informe um valor unitário válido.')
                    return
                  }
                  void runAction(async () => {
                    const updated = await ipc.createEntityExpense({
                      entityType: 'project',
                      entityId: project.id,
                      description: projectExpenseDescription.trim(),
                      supplier: projectExpenseSupplier.trim() || undefined,
                      quantity,
                      unitValue,
                    })
                    setProject(updated as Project)
                    setProjectExpenseDescription('')
                    setProjectExpenseSupplier('')
                    setProjectExpenseQuantity('1')
                    setProjectExpenseUnitValue('0')
                  }, 'Despesa criada com sucesso.')
                }}
              >
                <Plus className="h-4 w-4" />
                Adicionar despesa
              </Button>

              {(project.expenses ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem despesas cadastradas.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="font-semibold">Descrição</TableHead>
                        <TableHead className="font-semibold">Qtd</TableHead>
                        <TableHead className="font-semibold">Unit.</TableHead>
                        <TableHead className="font-semibold">Total</TableHead>
                        <TableHead className="font-semibold">Anexos</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(project.expenses ?? []).map((expense) => {
                        const receiptCount = (expense.receiptFiles ?? []).length
                        return (
                          <TableRow
                            key={expense.id}
                            className="cursor-pointer transition-colors hover:bg-muted/40"
                            onClick={() => setSelectedExpenseId(expense.id)}
                          >
                            <TableCell className="font-medium">{expense.description}</TableCell>
                            <TableCell>{expense.quantity}</TableCell>
                            <TableCell>R$ {expense.unitValue.toFixed(2)}</TableCell>
                            <TableCell>R$ {expense.totalValue.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={receiptCount > 0 ? 'secondary' : 'outline'}>
                                <Paperclip className="mr-1 h-3 w-3" />
                                {receiptCount}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={busy}
                                aria-label="Excluir despesa"
                                className="text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void runAction(async () => {
                                    const updated = await ipc.deleteEntityExpense({
                                      entityType: 'project',
                                      entityId: project.id,
                                      expenseId: expense.id,
                                    })
                                    setProject(updated as Project)
                                    if (selectedExpenseId === expense.id) {
                                      setSelectedExpenseId(null)
                                    }
                                  }, 'Despesa removida.')
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              <ExpenseReceiptDialog
                expense={selectedExpense}
                open={selectedExpenseId !== null}
                onOpenChange={(open) => {
                  if (!open) setSelectedExpenseId(null)
                }}
                isLoading={attachmentBusy}
                onUpload={(file) => {
                  if (!selectedExpense) return
                  void runAttachmentAction(async () => {
                    const base64Content = await fileToBase64(file)
                    const updated = await ipc.uploadExpenseAttachment({
                      entityType: 'project',
                      entityId: project.id,
                      expenseId: selectedExpense.id,
                      fileName: file.name,
                      mimeType: file.type || 'application/octet-stream',
                      base64Content,
                    })
                    setProject(updated as Project)
                  }, 'Comprovante enviado.')
                }}
                onDeleteReceipt={(attachmentId) => {
                  if (!selectedExpense) return
                  void runAttachmentAction(async () => {
                    const updated = await ipc.deleteExpenseAttachment({
                      entityType: 'project',
                      entityId: project.id,
                      expenseId: selectedExpense.id,
                      attachmentId,
                    })
                    setProject(updated as Project)
                  }, 'Comprovante removido.')
                }}
                onOpenAttachment={openAttachment}
              />
            </CardContent>
          </Card>

          {/* Anexos */}
          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                Anexos do projeto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label
                htmlFor="project-attachment"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Upload className="h-4 w-4" />
                Enviar anexo
              </Label>
              <input
                id="project-attachment"
                type="file"
                accept=".pdf,image/*"
                disabled={attachmentBusy}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  void runAttachmentAction(async () => {
                    const base64Content = await fileToBase64(file)
                    const updated = await ipc.uploadEntityAttachment({
                      entityType: 'project',
                      entityId: project.id,
                      fileName: file.name,
                      mimeType: file.type || 'application/octet-stream',
                      base64Content,
                    })
                    setProject(updated as Project)
                  }, 'Anexo enviado.')
                  e.currentTarget.value = ''
                }}
              />
              {(project.attachments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum anexo direto.</p>
              ) : (
                <ul className="space-y-1">
                  {(project.attachments ?? []).map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm"
                    >
                      <button
                        className="flex items-center gap-1.5 text-primary hover:underline"
                        onClick={() => void openAttachment(file)}
                      >
                        <FileText className="h-4 w-4" />
                        {file.fileName}
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={attachmentBusy}
                        className="h-7 text-destructive hover:text-destructive"
                        onClick={() =>
                          void runAttachmentAction(async () => {
                            const updated = await ipc.deleteEntityAttachment({
                              entityType: 'project',
                              entityId: project.id,
                              attachmentId: file.id,
                            })
                            setProject(updated as Project)
                          }, 'Anexo removido.')
                        }
                      >
                        Remover
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Nova tarefa */}
          {canManage ? (
            <Card className="surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  Nova tarefa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="task-title">Título</Label>
                    <Input
                      id="task-title"
                      value={taskDraft.title}
                      onChange={(e) => setTaskDraft((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Título da tarefa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-assignee">Responsável (ID, opcional)</Label>
                    <Input
                      id="task-assignee"
                      value={taskDraft.assigneeId}
                      onChange={(e) => setTaskDraft((p) => ({ ...p, assigneeId: e.target.value }))}
                      placeholder="ID do responsável"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="task-desc">Descrição</Label>
                    <Textarea
                      id="task-desc"
                      value={taskDraft.description}
                      onChange={(e) => setTaskDraft((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Descrição da tarefa"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button
                      disabled={busy || !taskDraft.title.trim()}
                      onClick={() =>
                        void runAction(async () => {
                          const updated = await ipc.createProjectTask({
                            projectId: project.id,
                            title: taskDraft.title.trim(),
                            description: taskDraft.description.trim() || undefined,
                            assigneeId: taskDraft.assigneeId.trim() || undefined,
                            expectedProjectUpdatedAt: project.updatedAt,
                          })
                          setProject(updated)
                          setTaskDraft(EMPTY_TASK)
                        }, 'Tarefa criada com sucesso.')
                      }
                    >
                      Criar tarefa
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Tarefas */}
          {project.tasks.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title="Sem tarefas"
              description="Nenhuma tarefa cadastrada neste projeto."
            />
          ) : (
            <div className="space-y-4">
              {project.tasks.map((task) => {
                const taskEdit = taskEditDraftById[task.id] ?? {
                  title: task.title,
                  description: task.description ?? '',
                  assigneeId: task.assigneeId ?? '',
                }
                const appointmentDraft = appointmentDraftByTask[task.id] ?? EMPTY_APPOINTMENT

                return (
                  <Card key={task.id} className="surface-card">
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{task.title}</CardTitle>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Badge variant="secondary">
                              {formatMinutesAsHours(getTaskTotalMinutes(task))}h
                            </Badge>
                            <Badge variant="outline">
                              {task.assigneeId ? `Resp.: ${task.assigneeId}` : 'Sem responsável'}
                            </Badge>
                          </div>
                        </div>
                        {canManage ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={busy}
                            aria-label="Excluir tarefa"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              void runAction(async () => {
                                const updated = await ipc.deleteProjectTask({
                                  projectId: project.id,
                                  taskId: task.id,
                                  expectedProjectUpdatedAt: project.updatedAt,
                                })
                                setProject(updated)
                              }, 'Tarefa excluída.')
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {canManage ? (
                        <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Título</Label>
                            <Input
                              value={taskEdit.title}
                              onChange={(e) =>
                                setTaskEditDraftById((p) => ({
                                  ...p,
                                  [task.id]: { ...taskEdit, title: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Responsável (ID)</Label>
                            <Input
                              value={taskEdit.assigneeId}
                              onChange={(e) =>
                                setTaskEditDraftById((p) => ({
                                  ...p,
                                  [task.id]: { ...taskEdit, assigneeId: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1.5 md:col-span-2">
                            <Label className="text-xs">Descrição</Label>
                            <Textarea
                              value={taskEdit.description}
                              onChange={(e) =>
                                setTaskEditDraftById((p) => ({
                                  ...p,
                                  [task.id]: { ...taskEdit, description: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                void runAction(async () => {
                                  const updated = await ipc.updateProjectTask({
                                    projectId: project.id,
                                    taskId: task.id,
                                    title: taskEdit.title.trim(),
                                    description: taskEdit.description.trim() || undefined,
                                    assigneeId: taskEdit.assigneeId.trim() || null,
                                    expectedProjectUpdatedAt: project.updatedAt,
                                  })
                                  setProject(updated)
                                }, 'Tarefa atualizada.')
                              }
                            >
                              Salvar tarefa
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {/* Novo apontamento */}
                      <div className="rounded-lg border p-3">
                        <p className="mb-2 text-sm font-medium">Novo apontamento manual</p>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Data</Label>
                            <Input
                              type="date"
                              value={appointmentDraft.date}
                              onChange={(e) =>
                                setAppointmentDraftByTask((p) => ({
                                  ...p,
                                  [task.id]: { ...appointmentDraft, date: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Início</Label>
                            <Input
                              type="time"
                              value={appointmentDraft.startTime}
                              onChange={(e) =>
                                setAppointmentDraftByTask((p) => ({
                                  ...p,
                                  [task.id]: { ...appointmentDraft, startTime: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Fim</Label>
                            <Input
                              type="time"
                              value={appointmentDraft.endTime}
                              onChange={(e) =>
                                setAppointmentDraftByTask((p) => ({
                                  ...p,
                                  [task.id]: { ...appointmentDraft, endTime: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Minutos</Label>
                            <Input
                              type="number"
                              min="0"
                              value={appointmentDraft.totalMinutes}
                              onChange={(e) =>
                                setAppointmentDraftByTask((p) => ({
                                  ...p,
                                  [task.id]: { ...appointmentDraft, totalMinutes: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1.5 md:col-span-2">
                            <Label className="text-xs">Observação</Label>
                            <Input
                              value={appointmentDraft.note}
                              onChange={(e) =>
                                setAppointmentDraftByTask((p) => ({
                                  ...p,
                                  [task.id]: { ...appointmentDraft, note: e.target.value },
                                }))
                              }
                              placeholder="Observação (opcional)"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() => {
                                const minutes = Number(appointmentDraft.totalMinutes)
                                if (!Number.isFinite(minutes) || minutes <= 0) {
                                  setError('Informe a duração do apontamento em minutos.')
                                  return
                                }
                                void runAction(async () => {
                                  await ipc.createProjectTaskAppointment({
                                    projectId: project.id,
                                    taskId: task.id,
                                    date: appointmentDraft.date,
                                    startTime: appointmentDraft.startTime,
                                    endTime: appointmentDraft.endTime,
                                    totalMinutes: minutes,
                                    note: appointmentDraft.note.trim() || undefined,
                                    expectedProjectUpdatedAt: project.updatedAt,
                                  })
                                  setAppointmentDraftByTask((p) => ({
                                    ...p,
                                    [task.id]: { ...EMPTY_APPOINTMENT },
                                  }))
                                  await loadProject()
                                }, 'Apontamento criado.')
                              }}
                            >
                              Salvar apontamento
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Lista de apontamentos */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Apontamentos</p>
                        {task.appointments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Sem apontamentos.</p>
                        ) : (
                          task.appointments.map((appointment) => {
                            const key = `${task.id}:${appointment.id}`
                            const editing = key === appointmentEditKey
                            return (
                              <div key={appointment.id} className="rounded-lg border p-3">
                                {editing ? (
                                  <div className="grid gap-3 md:grid-cols-3">
                                    <Input
                                      type="date"
                                      value={appointmentEditDraft.date}
                                      onChange={(e) =>
                                        setAppointmentEditDraft((p) => ({ ...p, date: e.target.value }))
                                      }
                                    />
                                    <Input
                                      type="time"
                                      value={appointmentEditDraft.startTime}
                                      onChange={(e) =>
                                        setAppointmentEditDraft((p) => ({
                                          ...p,
                                          startTime: e.target.value,
                                        }))
                                      }
                                    />
                                    <Input
                                      type="time"
                                      value={appointmentEditDraft.endTime}
                                      onChange={(e) =>
                                        setAppointmentEditDraft((p) => ({
                                          ...p,
                                          endTime: e.target.value,
                                        }))
                                      }
                                    />
                                    <Input
                                      type="number"
                                      min="0"
                                      value={appointmentEditDraft.totalMinutes}
                                      onChange={(e) =>
                                        setAppointmentEditDraft((p) => ({
                                          ...p,
                                          totalMinutes: e.target.value,
                                        }))
                                      }
                                    />
                                    <Input
                                      className="md:col-span-2"
                                      value={appointmentEditDraft.note}
                                      onChange={(e) =>
                                        setAppointmentEditDraft((p) => ({ ...p, note: e.target.value }))
                                      }
                                      placeholder="Observação"
                                    />
                                    <div className="flex gap-2 md:col-span-3">
                                      <Button
                                        size="sm"
                                        disabled={busy}
                                        onClick={() => {
                                          const minutes = Number(appointmentEditDraft.totalMinutes)
                                          if (!Number.isFinite(minutes) || minutes <= 0) {
                                            setError('Informe a duração em minutos.')
                                            return
                                          }
                                          void runAction(async () => {
                                            await ipc.updateProjectTaskAppointment({
                                              projectId: project.id,
                                              taskId: task.id,
                                              appointmentId: appointment.id,
                                              date: appointmentEditDraft.date,
                                              startTime: appointmentEditDraft.startTime,
                                              endTime: appointmentEditDraft.endTime,
                                              totalMinutes: minutes,
                                              note: appointmentEditDraft.note.trim() || undefined,
                                              expectedProjectUpdatedAt: project.updatedAt,
                                            })
                                            setAppointmentEditKey(null)
                                            await loadProject()
                                          }, 'Apontamento atualizado.')
                                        }}
                                      >
                                        Salvar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setAppointmentEditKey(null)}
                                      >
                                        Cancelar
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm">
                                      <span className="font-medium">{appointment.date}</span>
                                      <span className="text-muted-foreground">
                                        {' '}
                                        · {appointment.startTime} às {appointment.endTime} ·{' '}
                                        {appointment.totalMinutes} min · {appointment.origin}
                                      </span>
                                    </p>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setAppointmentEditKey(key)
                                          setAppointmentEditDraft({
                                            date: appointment.date,
                                            startTime: appointment.startTime,
                                            endTime: appointment.endTime,
                                            totalMinutes: String(appointment.totalMinutes),
                                            note: appointment.note ?? '',
                                          })
                                        }}
                                      >
                                        Editar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={busy}
                                        className="text-destructive hover:text-destructive"
                                        onClick={() =>
                                          void runAction(async () => {
                                            await ipc.deleteProjectTaskAppointment({
                                              projectId: project.id,
                                              taskId: task.id,
                                              appointmentId: appointment.id,
                                              expectedProjectUpdatedAt: project.updatedAt,
                                            })
                                            await loadProject()
                                          }, 'Apontamento removido.')
                                        }
                                      >
                                        Excluir
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
