import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Play, Save } from 'lucide-react'
import type {
  ApiIntegration,
  ApiIntegrationAuthType,
  ApiIntegrationKeyValue,
  ApiIntegrationKind,
  ApiIntegrationMethod,
} from '../../../shared/types'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { InlineLoader } from '@/components/shared/PageLoader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type TabId = 'parameters' | 'body' | 'auth' | 'headers' | 'transform' | 'settings'

const TABS: { id: TabId; label: string }[] = [
  { id: 'parameters', label: 'Parâmetros' },
  { id: 'body', label: 'Corpo' },
  { id: 'auth', label: 'Autenticação' },
  { id: 'headers', label: 'Cabeçalhos' },
  { id: 'transform', label: 'Transformação' },
  { id: 'settings', label: 'Configurações' },
]

const METHODS: ApiIntegrationMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const METHOD_CLASS: Record<ApiIntegrationMethod, string> = {
  GET: 'text-emerald-600',
  POST: 'text-orange-600',
  PUT: 'text-blue-600',
  PATCH: 'text-violet-600',
  DELETE: 'text-red-700',
}

function emptyRow(): ApiIntegrationKeyValue {
  return { key: '', value: '' }
}

function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = 'Chave',
  valuePlaceholder = 'Valor',
}: {
  rows: ApiIntegrationKeyValue[]
  onChange: (rows: ApiIntegrationKeyValue[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
}): JSX.Element {
  function update(index: number, patch: Partial<ApiIntegrationKeyValue>): void {
    const next = [...rows]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder={keyPlaceholder}
            value={row.key}
            onChange={(e) => update(index, { key: e.target.value })}
          />
          <Input
            placeholder={valuePlaceholder}
            value={row.value}
            onChange={(e) => update(index, { value: e.target.value })}
          />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, emptyRow()])}>
        + Adicionar linha
      </Button>
    </div>
  )
}

export default function ApiIntegrationDetailPage(): JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new' || !id

  const [loading, setLoading] = useState(!isNew)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('body')

  const [name, setName] = useState(isNew ? 'Nova integração simulada' : '')
  const [kind, setKind] = useState<ApiIntegrationKind>('rest_json')
  const [method, setMethod] = useState<ApiIntegrationMethod>('POST')
  const [url, setUrl] = useState(isNew ? 'https://api.exemplo.local/recurso' : '')
  const [body, setBody] = useState('')
  const [authType, setAuthType] = useState<ApiIntegrationAuthType>('none')
  const [authToken, setAuthToken] = useState('')
  const [parameters, setParameters] = useState<ApiIntegrationKeyValue[]>([emptyRow()])
  const [headers, setHeaders] = useState<ApiIntegrationKeyValue[]>([emptyRow()])
  const [transformFilter, setTransformFilter] = useState('')
  const [transformValue, setTransformValue] = useState('')
  const [transformText, setTransformText] = useState('')
  const [transformSort, setTransformSort] = useState('')
  const [transformErrorMessage, setTransformErrorMessage] = useState('')
  const [transformFriendlyMessage, setTransformFriendlyMessage] = useState('')
  const [accessoryFields, setAccessoryFields] = useState<ApiIntegrationKeyValue[]>([emptyRow()])
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    if (isNew || !id) return
    setLoading(true)
    void ipc
      .getApiIntegrationById(id)
      .then((item: ApiIntegration) => {
        setName(item.name)
        setKind(item.kind)
        setMethod(item.method)
        setUrl(item.url)
        setBody(item.body ?? '')
        setAuthType(item.authType)
        setAuthToken(item.authToken ?? '')
        setParameters(item.parameters.length ? item.parameters : [emptyRow()])
        setHeaders(item.headers.length ? item.headers : [emptyRow()])
        setTransformFilter(item.transformFilter ?? '')
        setTransformValue(item.transformValue ?? '')
        setTransformText(item.transformText ?? '')
        setTransformSort(item.transformSort ?? '')
        setTransformErrorMessage(item.transformErrorMessage ?? '')
        setTransformFriendlyMessage(item.transformFriendlyMessage ?? '')
        setAccessoryFields(item.accessoryFields.length ? item.accessoryFields : [emptyRow()])
        setLocked(item.locked ?? false)
      })
      .catch((e) => setError(getIpcErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [id, isNew])

  function buildPayload() {
    return {
      name: name.trim() || 'Nova integração simulada',
      kind,
      method,
      url: url.trim() || 'https://api.exemplo.local/recurso',
      body,
      authType,
      authToken,
      parameters,
      headers,
      transformFilter,
      transformValue,
      transformText,
      transformSort,
      transformErrorMessage,
      transformFriendlyMessage,
      accessoryFields,
      locked,
    }
  }

  async function handleSave(e?: FormEvent): Promise<void> {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    setFeedback(null)
    try {
      if (isNew) {
        const created = await ipc.createApiIntegration(buildPayload())
        navigate(`/settings/integrations/${created.id}`, { replace: true })
      } else if (id) {
        await ipc.updateApiIntegration({ id, ...buildPayload() })
      }
      setFeedback('Integração salva com sucesso.')
    } catch (err) {
      setError(getIpcErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <InlineLoader />

  return (
    <div className="space-y-6">
      <PageHeader title={isNew ? 'Nova integração' : name || 'Integração API'}>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/settings/integrations">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => void handleSave()}>
            <Play className="h-4 w-4" />
            Salvar e testar
          </Button>
          <Button type="button" className="gap-2" disabled={busy} onClick={() => void handleSave()}>
            <Save className="h-4 w-4" />
            Salvar
          </Button>
        </div>
      </PageHeader>

      {error ? <StatusAlert variant="error" message={error} /> : null}
      {feedback ? <StatusAlert variant="success" message={feedback} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <Card className="surface-card">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
              <Select value={method} onValueChange={(v) => setMethod(v as ApiIntegrationMethod)}>
                <SelectTrigger className={cn('w-[120px] font-semibold', METHOD_CLASS[method])}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m} className={METHOD_CLASS[m]}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="flex-1 font-mono text-sm"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
              <Badge variant="outline" className="self-center shrink-0">
                {'{ } RESTful JSON'}
              </Badge>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-1 border-b">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  tab === item.id
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Card className="surface-card">
            <CardContent className="space-y-4 p-4">
              {tab === 'parameters' ? (
                <KeyValueEditor rows={parameters} onChange={setParameters} />
              ) : null}

              {tab === 'body' ? (
                <div className="space-y-2">
                  <Label>JSON</Label>
                  <Textarea
                    rows={14}
                    className="font-mono text-sm"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </div>
              ) : null}

              {tab === 'auth' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={authType} onValueChange={(v) => setAuthType(v as ApiIntegrationAuthType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem autenticação</SelectItem>
                        <SelectItem value="bearer">Autenticação Bearer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {authType === 'bearer' ? (
                    <div className="space-y-2">
                      <Label>Token (opcional)</Label>
                      <Textarea rows={4} value={authToken} onChange={(e) => setAuthToken(e.target.value)} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === 'headers' ? (
                <KeyValueEditor rows={headers} onChange={setHeaders} />
              ) : null}

              {tab === 'transform' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Filtro ou loop</Label>
                    <Input value={transformFilter} onChange={(e) => setTransformFilter(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input value={transformValue} onChange={(e) => setTransformValue(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Texto</Label>
                    <Input value={transformText} onChange={(e) => setTransformText(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ordenar por</Label>
                    <Input value={transformSort} onChange={(e) => setTransformSort(e.target.value)} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Campos acessórios</Label>
                    <KeyValueEditor rows={accessoryFields} onChange={setAccessoryFields} />
                  </div>
                </div>
              ) : null}

              {tab === 'settings' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={kind} onValueChange={(v) => setKind(v as ApiIntegrationKind)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rest_json">RESTful JSON</SelectItem>
                        <SelectItem value="sql">Comando SQL</SelectItem>
                        <SelectItem value="fixed">Fixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={locked}
                      onChange={(e) => setLocked(e.target.checked)}
                    />
                    Bloquear edição (somente leitura para outros usuários)
                  </label>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </form>

        <Card className="surface-card h-fit">
          <CardContent className="p-6 text-center">
            <p className="text-sm font-medium">Não há alertas para exibir no momento</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Configure, teste e visualize resultados, alertas e diagnósticos da integração em tempo
              real.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
