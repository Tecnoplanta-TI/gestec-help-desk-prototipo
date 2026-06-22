import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRightLeft,
  ClipboardList,
  FileText,
  History,
  Paperclip,
  Pause,
  Play,
  Plus,
  Receipt,
  Square,
  Trash2,
  Upload,
} from 'lucide-react'
import type { AttachmentFile, Expense, Ticket, User, Workflow } from '../../../shared/types'
import { ZEEV_STEP_LABELS } from '../../../shared/lib/zeev-steps'
import { TicketZeevActions } from '@/components/tickets/TicketZeevActions'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { fileToBase64 } from '@/lib/files'
import { formatSeconds, getTimerTotalSeconds } from '@/lib/timer'
import { useAuthStore } from '@/stores/authStore'
import { useTimerStore } from '@/stores/timerStore'
import { SlaIndicator } from '@/components/tickets/SlaIndicator'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { EmptyState } from '@/components/shared/EmptyState'
import { InlineLoader } from '@/components/shared/PageLoader'
import { InfoRow } from '@/components/shared/InfoRow'
import { ExpenseReceiptDialog } from '@/components/shared/ExpenseReceiptDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function getErrorMessage(error: unknown): string {
  return getIpcErrorMessage(error, { fallback: 'Não foi possível carregar os detalhes do ticket.' })
}

function stepLabel(workflow: Workflow | null, stepId: string): string {
  if (!workflow) return stepId
  const step = workflow.steps.find((item) => item.id === stepId)
  return step ? step.name : stepId
}

export default function TicketDetailPage(): JSX.Element {
  const { id } = useParams()
  const currentUser = useAuthStore((state) => state.user)
  const timers = useTimerStore((state) => state.timers)
  const setTimers = useTimerStore((state) => state.setTimers)

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [nextStepId, setNextStepId] = useState('')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isTimerLoading, setIsTimerLoading] = useState(false)
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseSupplier, setExpenseSupplier] = useState('')
  const [expenseQuantity, setExpenseQuantity] = useState('1')
  const [expenseUnitValue, setExpenseUnitValue] = useState('0')
  const [isExpenseLoading, setIsExpenseLoading] = useState(false)
  const [isAttachmentLoading, setIsAttachmentLoading] = useState(false)
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const availableSteps = useMemo(() => {
    if (!workflow || !ticket) return []
    return workflow.steps.filter((step) => step.id !== ticket.status)
  }, [workflow, ticket])

  const currentTicketTimer = useMemo(() => {
    if (!ticket) return null
    return (
      timers.find((timer) => timer.entityType === 'ticket' && timer.entityId === ticket.id) ?? null
    )
  }, [timers, ticket])

  useEffect(() => {
    async function load(): Promise<void> {
      if (!id) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const result = await ipc.getTicketById(id)
        setTicket(result)

        const workflows = await ipc.listWorkflows()
        const currentWorkflow = workflows.find((item) => item.id === result.workflowId) ?? null
        setWorkflow(currentWorkflow)
        void ipc.listUsers().then(setUsers).catch(() => undefined)
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id])

  useEffect(() => {
    if (!availableSteps.length) {
      setNextStepId('')
      return
    }
    setNextStepId((current) =>
      current && availableSteps.some((step) => step.id === current) ? current : availableSteps[0].id,
    )
  }, [availableSteps])

  async function handleTransition(): Promise<void> {
    if (!ticket || !nextStepId) return
    setError(null)
    setFeedback(null)
    setIsTransitioning(true)
    try {
      const updated = await ipc.transitionTicketStep({ ticketId: ticket.id, toStepId: nextStepId })
      setTicket(updated)
      setFeedback('Etapa atualizada com sucesso.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsTransitioning(false)
    }
  }

  async function refreshTimers(): Promise<void> {
    const active = await ipc.getActiveTimers()
    setTimers(active)
  }

  async function handleStartOrResumeTimer(): Promise<void> {
    if (!ticket) return
    setError(null)
    setFeedback(null)
    setIsTimerLoading(true)
    try {
      await ipc.startTimer(ticket.id, 'ticket', ticket.title)
      await refreshTimers()
      setFeedback('Cronômetro iniciado.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsTimerLoading(false)
    }
  }

  async function handlePauseTimer(): Promise<void> {
    if (!currentTicketTimer) return
    setError(null)
    setFeedback(null)
    setIsTimerLoading(true)
    try {
      await ipc.pauseTimer(currentTicketTimer.id)
      await refreshTimers()
      setFeedback('Cronômetro pausado.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsTimerLoading(false)
    }
  }

  async function handleStopTimer(): Promise<void> {
    if (!currentTicketTimer) return
    setError(null)
    setFeedback(null)
    setIsTimerLoading(true)
    try {
      await ipc.stopTimer(currentTicketTimer.id)
      await refreshTimers()
      const updatedTicket = await ipc.getTicketById(currentTicketTimer.entityId)
      setTicket(updatedTicket)
      setFeedback('Cronômetro parado e apontamento gerado automaticamente.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsTimerLoading(false)
    }
  }

  async function handleCreateExpense(): Promise<void> {
    if (!ticket) return
    setError(null)
    setFeedback(null)

    const quantity = Number(expenseQuantity)
    const unitValue = Number(expenseUnitValue)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Informe uma quantidade válida (maior que zero).')
      return
    }
    if (!Number.isFinite(unitValue) || unitValue < 0) {
      setError('Informe um valor unitário válido.')
      return
    }

    setIsExpenseLoading(true)
    try {
      const updated = await ipc.createEntityExpense({
        entityType: 'ticket',
        entityId: ticket.id,
        description: expenseDescription.trim(),
        supplier: expenseSupplier.trim() || undefined,
        quantity,
        unitValue,
      })
      setTicket(updated as Ticket)
      setExpenseDescription('')
      setExpenseSupplier('')
      setExpenseQuantity('1')
      setExpenseUnitValue('0')
      setFeedback('Despesa criada com sucesso.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsExpenseLoading(false)
    }
  }

  async function handleDeleteExpense(expenseId: string): Promise<void> {
    if (!ticket) return
    setError(null)
    setFeedback(null)
    setIsExpenseLoading(true)
    try {
      const updated = await ipc.deleteEntityExpense({
        entityType: 'ticket',
        entityId: ticket.id,
        expenseId,
      })
      setTicket(updated as Ticket)
      if (selectedExpenseId === expenseId) {
        setSelectedExpenseId(null)
      }
      setFeedback('Despesa removida.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsExpenseLoading(false)
    }
  }

  async function handleUploadExpenseAttachment(expenseId: string, file: File): Promise<void> {
    if (!ticket) return
    setError(null)
    setFeedback(null)
    setIsAttachmentLoading(true)
    try {
      const base64Content = await fileToBase64(file)
      const updated = await ipc.uploadExpenseAttachment({
        entityType: 'ticket',
        entityId: ticket.id,
        expenseId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64Content,
      })
      setTicket(updated as Ticket)
      setFeedback('Comprovante enviado.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsAttachmentLoading(false)
    }
  }

  async function handleDeleteExpenseAttachment(expenseId: string, attachmentId: string): Promise<void> {
    if (!ticket) return
    setError(null)
    setFeedback(null)
    setIsAttachmentLoading(true)
    try {
      const updated = await ipc.deleteExpenseAttachment({
        entityType: 'ticket',
        entityId: ticket.id,
        expenseId,
        attachmentId,
      })
      setTicket(updated as Ticket)
      setFeedback('Comprovante removido.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsAttachmentLoading(false)
    }
  }

  async function handleUploadEntityAttachment(file: File): Promise<void> {
    if (!ticket) return
    setError(null)
    setFeedback(null)
    setIsAttachmentLoading(true)
    try {
      const base64Content = await fileToBase64(file)
      const updated = await ipc.uploadEntityAttachment({
        entityType: 'ticket',
        entityId: ticket.id,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64Content,
      })
      setTicket(updated as Ticket)
      setFeedback('Anexo enviado.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsAttachmentLoading(false)
    }
  }

  async function handleDeleteEntityAttachment(attachmentId: string): Promise<void> {
    if (!ticket) return
    setError(null)
    setFeedback(null)
    setIsAttachmentLoading(true)
    try {
      const updated = await ipc.deleteEntityAttachment({
        entityType: 'ticket',
        entityId: ticket.id,
        attachmentId,
      })
      setTicket(updated as Ticket)
      setFeedback('Anexo removido.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsAttachmentLoading(false)
    }
  }

  async function openAttachment(attachment: AttachmentFile): Promise<void> {
    try {
      const url = await ipc.getAttachmentDownloadUrl({ blobKey: attachment.blobKey })
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const canTransition = currentUser?.role === 'admin' || currentUser?.role === 'manager'

  const selectedExpense = useMemo((): Expense | null => {
    if (!ticket || !selectedExpenseId) return null
    return (ticket.expenses ?? []).find((e) => e.id === selectedExpenseId) ?? null
  }, [ticket, selectedExpenseId])

  return (
    <div className="space-y-6">
      <PageHeader title="Detalhe do ticket" description="Visualização completa do chamado.">
        <Button variant="outline" asChild>
          <Link to="/tickets">
            <ArrowLeft className="h-4 w-4" />
            Voltar para lista
          </Link>
        </Button>
      </PageHeader>

      {error ? <StatusAlert variant="error" message={error} /> : null}
      {feedback ? <StatusAlert variant="success" message={feedback} /> : null}

      {ticket ? (
        <TicketZeevActions
          ticket={ticket}
          user={currentUser}
          users={users}
          onUpdated={(updated) => {
            setTicket(updated)
            setFeedback('Ticket atualizado.')
          }}
        />
      ) : null}

      {loading ? (
        <InlineLoader rows={4} />
      ) : !ticket ? (
        <EmptyState
          icon={FileText}
          title="Ticket não encontrado"
          description="O chamado solicitado não existe ou foi removido."
          action={
            <Button variant="outline" asChild>
              <Link to="/tickets">Voltar para lista</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Informações */}
            <Card className="surface-card">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle className="text-lg">{ticket.title}</CardTitle>
                  <SlaIndicator status={ticket.sla.status} deadline={ticket.sla.deadline} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {ticket.description}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Prioridade {ticket.priority}</Badge>
                  <Badge variant="outline">{ticket.type}</Badge>
                  <Badge variant="outline">{ticket.serviceGroup}</Badge>
                </div>

                <dl className="rounded-lg border bg-muted/20 px-4">
                  <InfoRow label="ID" value={<span className="font-mono text-xs">{ticket.id}</span>} />
                  <InfoRow label="Origem" value={<span className="capitalize">{ticket.source}</span>} />
                  <InfoRow label="Status" value={stepLabel(workflow, ticket.status)} />
                  <InfoRow
                    label="SLA"
                    value={
                      ticket.sla.deadline
                        ? new Date(ticket.sla.deadline).toLocaleString('pt-BR')
                        : 'Sem prazo definido'
                    }
                  />
                  <InfoRow label="Workflow" value={workflow?.name ?? ticket.workflowId} />
                  <InfoRow label="Solicitante" value={ticket.requester.name} />
                  <InfoRow label="E-mail" value={ticket.requester.email} />
                  <InfoRow label="Centro de custo" value={ticket.requester.costCenter} />
                  <InfoRow label="Criado em" value={new Date(ticket.createdAt).toLocaleString('pt-BR')} />
                  <InfoRow
                    label="Atualizado em"
                    value={new Date(ticket.updatedAt).toLocaleString('pt-BR')}
                  />
                </dl>
              </CardContent>
            </Card>

            {/* Despesas */}
            <Card className="surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  Despesas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="exp-desc">Descrição</Label>
                    <Input
                      id="exp-desc"
                      value={expenseDescription}
                      onChange={(e) => setExpenseDescription(e.target.value)}
                      placeholder="Descrição da despesa"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="exp-supplier">Fornecedor (opcional)</Label>
                    <Input
                      id="exp-supplier"
                      value={expenseSupplier}
                      onChange={(e) => setExpenseSupplier(e.target.value)}
                      placeholder="Nome do fornecedor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exp-qty">Quantidade</Label>
                    <Input
                      id="exp-qty"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={expenseQuantity}
                      onChange={(e) => setExpenseQuantity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exp-unit">Valor unitário (R$)</Label>
                    <Input
                      id="exp-unit"
                      type="number"
                      min="0"
                      step="0.01"
                      value={expenseUnitValue}
                      onChange={(e) => setExpenseUnitValue(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => void handleCreateExpense()}
                  disabled={isExpenseLoading || !expenseDescription.trim()}
                  variant="secondary"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {isExpenseLoading ? 'Salvando...' : 'Adicionar despesa'}
                </Button>

                {(ticket.expenses ?? []).length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="Sem despesas"
                    description="Nenhuma despesa cadastrada para este ticket."
                  />
                ) : (
                  <div className="space-y-3">
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
                          {(ticket.expenses ?? []).map((expense) => {
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
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void handleDeleteExpense(expense.id)
                                    }}
                                    disabled={isExpenseLoading}
                                    aria-label="Excluir despesa"
                                    className="text-destructive hover:text-destructive"
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

                    <ExpenseReceiptDialog
                      expense={selectedExpense}
                      open={selectedExpenseId !== null}
                      onOpenChange={(open) => {
                        if (!open) setSelectedExpenseId(null)
                      }}
                      isLoading={isAttachmentLoading}
                      onUpload={(file) =>
                        selectedExpense
                          ? handleUploadExpenseAttachment(selectedExpense.id, file)
                          : undefined
                      }
                      onDeleteReceipt={(attachmentId) =>
                        selectedExpense
                          ? handleDeleteExpenseAttachment(selectedExpense.id, attachmentId)
                          : undefined
                      }
                      onOpenAttachment={openAttachment}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Anexos do ticket */}
            <Card className="surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  Anexos do ticket
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label
                  htmlFor="ticket-attachment"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <Upload className="h-4 w-4" />
                  Enviar anexo
                </Label>
                <input
                  id="ticket-attachment"
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  disabled={isAttachmentLoading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleUploadEntityAttachment(file)
                    e.currentTarget.value = ''
                  }}
                />
                {(ticket.attachments ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum anexo direto.</p>
                ) : (
                  <ul className="space-y-1">
                    {(ticket.attachments ?? []).map((file) => (
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
                          onClick={() => void handleDeleteEntityAttachment(file.id)}
                          disabled={isAttachmentLoading}
                          className="h-7 text-destructive hover:text-destructive"
                        >
                          Remover
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Coluna lateral */}
          <div className="space-y-6">
            {/* Cronômetro */}
            <Card className="surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Play className="h-4 w-4 text-muted-foreground" />
                  Cronômetro
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!currentTicketTimer ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Nenhum cronômetro ativo.</p>
                    <Button
                      onClick={() => void handleStartOrResumeTimer()}
                      disabled={isTimerLoading}
                      className="w-full gap-2"
                    >
                      <Play className="h-4 w-4" />
                      {isTimerLoading ? 'Processando...' : 'Iniciar cronômetro'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-muted/30 p-4 text-center">
                      <p className="font-mono text-3xl font-semibold tracking-tight">
                        {formatSeconds(getTimerTotalSeconds(currentTicketTimer))}
                      </p>
                      <Badge
                        variant={currentTicketTimer.state === 'running' ? 'default' : 'secondary'}
                        className="mt-2"
                      >
                        {currentTicketTimer.state === 'running' ? 'Em andamento' : 'Pausado'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {currentTicketTimer.state === 'running' ? (
                        <Button
                          variant="outline"
                          onClick={() => void handlePauseTimer()}
                          disabled={isTimerLoading}
                          className="gap-2"
                        >
                          <Pause className="h-4 w-4" />
                          Pausar
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => void handleStartOrResumeTimer()}
                          disabled={isTimerLoading}
                          className="gap-2"
                        >
                          <Play className="h-4 w-4" />
                          Retomar
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        onClick={() => void handleStopTimer()}
                        disabled={isTimerLoading}
                        className="gap-2"
                      >
                        <Square className="h-4 w-4" />
                        Parar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Transição de etapa */}
            <Card className="surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                  Transição de etapa
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!canTransition ? (
                  <p className="text-sm text-muted-foreground">
                    Apenas gestores e administradores podem executar transições.
                  </p>
                ) : availableSteps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Não há etapas disponíveis.</p>
                ) : (
                  <div className="space-y-3">
                    <Select value={nextStepId} onValueChange={setNextStepId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSteps.map((step) => (
                          <SelectItem key={step.id} value={step.id}>
                            {step.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => void handleTransition()}
                      disabled={isTransitioning || !nextStepId}
                      className="w-full gap-2"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      {isTransitioning ? 'Transicionando...' : 'Mover etapa'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Histórico */}
            <Card className="surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Histórico de workflow
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(ticket.workflowHistory ?? []).length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="Sem transições"
                    description="Nenhuma mudança de etapa registrada."
                  />
                ) : (
                  <ol className="relative space-y-4 border-l pl-4">
                    {(ticket.workflowHistory ?? []).map((entry) => (
                      <li key={entry.id} className="relative">
                        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                        <p className="text-sm font-medium">
                          {stepLabel(workflow, entry.fromStepId)}{' '}
                          <span className="text-muted-foreground">{'→'}</span>{' '}
                          {stepLabel(workflow, entry.toStepId)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.changedAt).toLocaleString('pt-BR')}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
