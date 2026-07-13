import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Plus, Search } from 'lucide-react'
import type { ApiIntegration, ApiIntegrationKind } from '../../../shared/types'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { EmptyState } from '@/components/shared/EmptyState'
import { InlineLoader } from '@/components/shared/PageLoader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const KIND_LABEL: Record<ApiIntegrationKind, string> = {
  rest_json: 'RESTful JSON',
  sql: 'Comando SQL',
  fixed: 'Fixa',
}

const KIND_VARIANT: Record<ApiIntegrationKind, 'default' | 'secondary' | 'outline'> = {
  rest_json: 'default',
  sql: 'secondary',
  fixed: 'outline',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR')
}

export default function ApiIntegrationsListPage(): JSX.Element {
  const [items, setItems] = useState<ApiIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function load(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      setItems(await ipc.listApiIntegrations())
    } catch (e) {
      setError(getIpcErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q) ||
        item.createdByName.toLowerCase().includes(q),
    )
  }, [items, search])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrações"
        description="Configure chamadas HTTP e integrações externas, no estilo operacional."
      >
        <Button asChild className="gap-2">
          <Link to="/settings/integrations/new">
            <Plus className="h-4 w-4" />
            Adicionar
          </Link>
        </Button>
      </PageHeader>

      {error ? <StatusAlert variant="error" message={error} /> : null}

      <Card className="surface-card">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
          </p>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Pesquisar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <InlineLoader rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhuma integração" description="Crie a primeira integração API." />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Tipo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead>Modificado em</TableHead>
                <TableHead className="w-12" />
                <TableHead className="w-16">#</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant={KIND_VARIANT[item.kind]}>{KIND_LABEL[item.kind]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/settings/integrations/${item.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{item.createdByName}</p>
                      <p className="text-xs text-muted-foreground">{item.createdById.slice(0, 8)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(item.updatedAt)}
                  </TableCell>
                  <TableCell>
                    {item.locked ? <Lock className="h-4 w-4 text-destructive" /> : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {index + 1}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
