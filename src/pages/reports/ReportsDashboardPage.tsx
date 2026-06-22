import { useEffect, useState } from 'react'
import type { TicketReportStats } from '../../../shared/types'
import { ipc } from '@/lib/ipc'
import { PageHeader } from '@/components/shared/PageHeader'
import { InlineLoader } from '@/components/shared/PageLoader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ReportsDashboardPage(): JSX.Element {
  const [stats, setStats] = useState<TicketReportStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void ipc.getTicketReportStats().then(setStats).finally(() => setLoading(false))
  }, [])

  if (loading) return <InlineLoader />

  return (
    <div className="space-y-6">
      <PageHeader title="Indicadores" description="KPIs operacionais — fluxo Zeev" />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tickets abertos</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{stats?.totalOpen ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Nota média</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {stats?.averageScore != null ? stats.averageScore.toFixed(1) : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Avaliações</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{stats?.evaluationCount ?? 0}</CardContent>
        </Card>
      </div>
      {stats && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Por tipo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {Object.entries(stats.byType).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Por prioridade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {Object.entries(stats.byPriority).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
