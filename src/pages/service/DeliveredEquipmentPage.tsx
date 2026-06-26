import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { DeliveredEquipmentItem, Ticket } from '../../../shared/types'
import { ZEEV_STEPS } from '../../../shared/lib/zeev-steps'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { InlineLoader } from '@/components/shared/PageLoader'
import { DeliveredEquipmentPanel } from '@/components/tickets/DeliveredEquipmentPanel'
import { Button } from '@/components/ui/button'

export default function DeliveredEquipmentPage(): JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [equipment, setEquipment] = useState<DeliveredEquipmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canEdit = ticket?.status === ZEEV_STEPS.in_service

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await ipc.getTicketById(id)
      setTicket(data)
      setEquipment(data.deliveredEquipment ?? [])
    } catch (e) {
      setError(getIpcErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function persist(): Promise<void> {
    if (!ticket || !canEdit) return
    setBusy(true)
    try {
      const updated = await ipc.updateServiceTicket({
        ticketId: ticket.id,
        deliveredEquipment: equipment,
      })
      setTicket(updated)
      setEquipment(updated.deliveredEquipment ?? [])
      toast({ title: 'Equipamentos salvos' })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: getIpcErrorMessage(e),
      })
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <InlineLoader />

  if (!ticket) {
    return <StatusAlert variant="error" message="Ticket não encontrado." />
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Equipamentos entregues"
        description={`Ticket ${ticket.ticketNumber ?? ticket.id.slice(0, 8)} — ${ticket.title}`}
      >
        <Button asChild variant="outline" className="gap-2">
          <Link to={`/service/${ticket.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Voltar ao atendimento
          </Link>
        </Button>
      </PageHeader>

      {error ? <StatusAlert variant="error" message={error} /> : null}

      <DeliveredEquipmentPanel
        equipment={equipment}
        onChange={setEquipment}
        onPersist={() => void persist()}
        readOnly={!canEdit}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate(`/service/${ticket.id}`)}>
          Voltar
        </Button>
        {canEdit ? (
          <Button type="button" disabled={busy} onClick={() => void persist()}>
            {busy ? 'Salvando…' : 'Salvar equipamentos'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
