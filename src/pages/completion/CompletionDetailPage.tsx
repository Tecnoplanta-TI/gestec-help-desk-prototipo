import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import type { Ticket, User } from '../../../shared/types'
import { formatDuration } from '../../../shared/lib/time'
import { WORKFLOW_STEPS } from '../../../shared/lib/workflow-steps'
import { hasPermission } from '../../../shared/lib/permissions'
import { getTicketDisplayId } from '../../../shared/lib/ticket-public-id'
import {
  LEVEL_LABEL,
  PRIORITY_LABEL,
  SERVICE_GROUP_LABEL,
  TICKET_TYPE_LABEL,
} from '@/lib/ticket-labels'
import { computeTicketBilling, formatCurrency } from '@/lib/ticket-billing'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { InfoRow } from '@/components/shared/InfoRow'
import { InlineLoader } from '@/components/shared/PageLoader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

function userName(users: User[], id?: string): string {
  if (!id) return '—'
  return users.find((u) => u.id === id)?.name ?? id.slice(0, 8)
}

function boolLabel(value?: boolean): string {
  if (value === true) return 'Sim'
  if (value === false) return 'Não'
  return '—'
}

export default function CompletionDetailPage(): JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const currentUser = useAuthStore((state) => state.user)

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [justification, setJustification] = useState('')
  const [message, setMessage] = useState('')

  const billing = useMemo(() => (ticket ? computeTicketBilling(ticket) : null), [ticket])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        const [ticketData, usersData] = await Promise.all([
          ipc.getTicketById(id),
          ipc.listUsers(),
        ])
        if (!cancelled) {
          setTicket(ticketData)
          setUsers(usersData)
        }
      } catch (e) {
        if (!cancelled) setError(getIpcErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (!currentUser || !hasPermission(currentUser, 'triage')) {
    return (
      <div className="space-y-4">
        <StatusAlert variant="error" message="Você não tem permissão para aprovar conclusões." />
        <Button variant="outline" asChild>
          <Link to="/completion">Voltar à fila</Link>
        </Button>
      </div>
    )
  }

  if (loading) return <InlineLoader />
  if (error || !ticket) {
    return (
      <div className="space-y-4">
        <StatusAlert variant="error" message={error ?? 'Ticket não encontrado.'} />
        <Button variant="outline" asChild>
          <Link to="/completion">Voltar à fila</Link>
        </Button>
      </div>
    )
  }

  if (ticket.status !== WORKFLOW_STEPS.awaiting_completion_approval) {
    return (
      <div className="space-y-4">
        <StatusAlert variant="error" message="Este ticket não aguarda aprovação de conclusão." />
        <Button variant="outline" asChild>
          <Link to={`/tickets/${ticket.id}`}>Ver detalhes</Link>
        </Button>
      </div>
    )
  }

  async function decide(approved: boolean) {
    if (!ticket) return
    if (!approved && !justification.trim()) {
      toast({
        variant: 'destructive',
        title: 'Justificativa obrigatória para recusar',
      })
      return
    }
    setBusy(true)
    try {
      await ipc.approveTicketCompletion({
        ticketId: ticket.id,
        approved,
        justification: justification.trim() || undefined,
      })
      toast({
        title: approved ? 'Conclusão aprovada' : 'Devolvido ao atendente',
      })
      navigate('/completion')
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível concluir a aprovação',
        description: getIpcErrorMessage(e),
      })
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage() {
    if (!ticket || !message.trim()) return
    setBusy(true)
    try {
      const updated = await ipc.addTicketComment({
        ticketId: ticket.id,
        body: message.trim(),
        isInternal: false,
      })
      setTicket(updated)
      setMessage('')
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar mensagem',
        description: getIpcErrorMessage(e),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Aprovar conclusão · ${getTicketDisplayId(ticket)}`}
        description={ticket.title}
      >
        <Button variant="outline" size="sm" asChild>
          <Link to="/completion">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Fila de aprovação
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Solicitante</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <InfoRow
                  label="Data abertura"
                  value={formatDateTime(ticket.openedAt ?? ticket.createdAt)}
                />
                <InfoRow label="Solicitante" value={ticket.requester.name} />
              </dl>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <InfoRow label="Número" value={getTicketDisplayId(ticket)} />
                <InfoRow label="Centro de custo" value={ticket.requester.costCenter} />
                <InfoRow label="Tipo" value={TICKET_TYPE_LABEL[ticket.type]} />
                <InfoRow label="Prioridade" value={PRIORITY_LABEL[ticket.priority]} />
                <InfoRow label="Nível" value={ticket.level ? LEVEL_LABEL[ticket.level] : '—'} />
                <InfoRow label="Grupo" value={SERVICE_GROUP_LABEL[ticket.serviceGroup]} />
                <InfoRow label="Solicitação" value={ticket.description} />
              </dl>
            </CardContent>
          </Card>

          {ticket.serviceGroup === 'access_accounts' && (
            <Card className="surface-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Facilitador</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <InfoRow label="Criar usuário na plataforma?" value={boolLabel(ticket.createPlatformUser)} />
                  <InfoRow label="Criar e-mail?" value={boolLabel(ticket.createEmail)} />
                  <InfoRow
                    label="Realizar checklist?"
                    value={ticket.facilitatorChecklist ?? '—'}
                  />
                </dl>
              </CardContent>
            </Card>
          )}

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Responsável</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <InfoRow label="Atendente" value={userName(users, ticket.assigneeId)} />
                <InfoRow
                  label="Prazo do atendimento"
                  value={
                    ticket.serviceDueDate
                      ? new Date(ticket.serviceDueDate).toLocaleDateString('pt-BR')
                      : '—'
                  }
                />
                <InfoRow
                  label="Responsável adicional"
                  value={userName(users, ticket.additionalAssigneeId)}
                />
              </dl>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Lacre de segurança</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <InfoRow label="Houve troca do lacre?" value={boolLabel(ticket.securitySealChanged)} />
                {ticket.securitySealChanged && (
                  <>
                    <InfoRow label="Código anterior" value={ticket.securitySealCode ?? '—'} />
                    <InfoRow label="Novo código" value={ticket.newSecuritySealCode ?? '—'} />
                  </>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Apontamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {(ticket.appointments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum apontamento.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ticket.appointments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{userName(users, a.technicianId)}</TableCell>
                        <TableCell>{a.date}</TableCell>
                        <TableCell>{a.note ?? '—'}</TableCell>
                        <TableCell>{formatDuration(a.totalMinutes)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tabela de cobrança</CardTitle>
            </CardHeader>
            <CardContent>
              {(ticket.expenses ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum material/serviço lançado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material/serviço</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Custo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ticket.expenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{e.description}</TableCell>
                        <TableCell>{e.quantity}</TableCell>
                        <TableCell>{formatCurrency(e.totalValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Equipamentos entregues</CardTitle>
            </CardHeader>
            <CardContent>
              {(ticket.deliveredEquipment ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum equipamento.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Patrimonial</TableHead>
                      <TableHead>Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ticket.deliveredEquipment ?? []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.assetId || '—'}</TableCell>
                        <TableCell>{row.description || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Mensagens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(ticket.comments ?? []).map((c) => (
                <div key={c.id} className="rounded-md border p-2 text-sm">
                  <span className="font-medium">{userName(users, c.authorId)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatDateTime(c.createdAt)}
                  </span>
                  <p className="mt-1 text-muted-foreground">{c.body}</p>
                </div>
              ))}
              <div className="flex gap-2">
                <Textarea
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite uma mensagem..."
                />
                <Button disabled={busy || !message.trim()} onClick={() => void sendMessage()}>
                  Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
          {billing && (
            <Card className="surface-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cobrança</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço/hora</span>
                  <span>{formatCurrency(billing.hourlyRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor atendimento</span>
                  <span>{formatCurrency(billing.serviceValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Materiais</span>
                  <span>{formatCurrency(billing.materialCost)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Valor final</span>
                  <span>{formatCurrency(billing.finalValue)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="surface-card border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Decisão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Justificativa (obrigatória se recusar)</Label>
                <Textarea
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                />
              </div>
              <Button className="w-full" disabled={busy} onClick={() => void decide(true)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Aprovar conclusão
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                disabled={busy || !justification.trim()}
                onClick={() => void decide(false)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Devolver ao atendente
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
