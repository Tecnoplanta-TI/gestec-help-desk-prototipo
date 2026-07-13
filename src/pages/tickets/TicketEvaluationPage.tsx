import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { AppConfig, Ticket } from '../../../shared/types'
import { WORKFLOW_STEPS } from '../../../shared/lib/workflow-steps'
import { isTicketRequester } from '../../../shared/lib/ticket-access'
import { getTicketDisplayId } from '../../../shared/lib/ticket-public-id'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { InlineLoader } from '@/components/shared/PageLoader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export default function TicketEvaluationPage(): JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [metExpectation, setMetExpectation] = useState(true)
  const [score, setScore] = useState<number>(8)
  const [feedback, setFeedback] = useState('')
  const [npsJustification, setNpsJustification] = useState('')
  const [expectation, setExpectation] = useState('')

  const lowScoreThreshold = config?.npsLowScoreThreshold ?? 6
  const requiresNpsJustification = score <= lowScoreThreshold
  const requiresExpectation = !metExpectation

  const scoreTone = useMemo(() => {
    if (score <= lowScoreThreshold) return 'low'
    if (score >= 9) return 'high'
    return 'mid'
  }, [score, lowScoreThreshold])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    void Promise.all([ipc.getTicketById(id), ipc.getAppConfig()])
      .then(([ticketData, appConfig]) => {
        setTicket(ticketData)
        setConfig(appConfig)
      })
      .catch((e) => setError(getIpcErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [id])

  const canEvaluate =
    ticket &&
    currentUser &&
    ticket.status === WORKFLOW_STEPS.awaiting_evaluation &&
    isTicketRequester(ticket, currentUser)

  async function handleSubmit(): Promise<void> {
    if (!ticket) return
    if (requiresNpsJustification && !npsJustification.trim()) {
      setError('Informe a justificativa para nota baixa.')
      return
    }
    if (requiresExpectation && !expectation.trim()) {
      setError('Descreva qual era a sua expectativa.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await ipc.submitTicketEvaluation({
        ticketId: ticket.id,
        metExpectation,
        score,
        feedback: feedback.trim() || undefined,
        npsJustification: requiresNpsJustification ? npsJustification.trim() : undefined,
        expectation: requiresExpectation ? expectation.trim() : undefined,
      })
      navigate(`/tickets/${ticket.id}`, { replace: true })
    } catch (e) {
      setError(getIpcErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <InlineLoader />

  if (!ticket || !canEvaluate) {
    return (
      <div className="space-y-4">
        <StatusAlert variant="error" message="Este ticket não está disponível para avaliação." />
        <Button asChild variant="outline">
          <Link to={id ? `/tickets/${id}` : '/tickets'}>Voltar</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Avaliação do serviço"
        description={`Ticket ${getTicketDisplayId(ticket)} - ${ticket.title}`}
      >
        <Button asChild variant="outline" className="gap-2">
          <Link to={`/tickets/${ticket.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      {error ? <StatusAlert variant="error" message={error} /> : null}

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Como foi o atendimento?</CardTitle>
          <CardDescription>
            Sua avaliação ajuda a TI a medir qualidade. Notas até {lowScoreThreshold} exigem
            justificativa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>O atendimento atendeu sua expectativa?</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={metExpectation ? 'default' : 'outline'}
                onClick={() => setMetExpectation(true)}
              >
                Sim
              </Button>
              <Button
                type="button"
                variant={!metExpectation ? 'default' : 'outline'}
                onClick={() => setMetExpectation(false)}
              >
                Não
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Nota de 1 a 10</Label>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {SCORES.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={score === value ? 'default' : 'outline'}
                  className={cn(
                    'h-11 w-full font-semibold',
                    score === value && scoreTone === 'low' && 'bg-destructive hover:bg-destructive/90',
                    score === value && scoreTone === 'high' && 'bg-primary',
                  )}
                  onClick={() => setScore(value)}
                >
                  {value}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {scoreTone === 'low'
                ? 'Nota baixa — justificativa obrigatória.'
                : scoreTone === 'high'
                  ? 'Ótima avaliação! Obrigado pelo feedback.'
                  : 'Avaliação registrada na escala NPS.'}
            </p>
          </div>

          {requiresNpsJustification ? (
            <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <Label>
                Justificativa NPS <span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={3}
                value={npsJustification}
                onChange={(e) => setNpsJustification(e.target.value)}
                placeholder="Por que a nota foi baixa?"
              />
            </div>
          ) : null}

          {requiresExpectation ? (
            <div className="space-y-2 rounded-lg border p-4">
              <Label>
                Qual era a sua expectativa? <span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={3}
                value={expectation}
                onChange={(e) => setExpectation(e.target.value)}
                placeholder="Descreva o que você esperava do atendimento."
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Comentários adicionais</Label>
            <Textarea
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Opcional — elogios, sugestões ou observações."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to={`/tickets/${ticket.id}`}>Cancelar</Link>
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleSubmit()}>
              {busy ? 'Enviando…' : 'Enviar avaliação'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
