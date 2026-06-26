import { useEffect, useMemo, useState } from 'react'
import { Pause, PanelLeft, Pin, PinOff, Play, Square, Timer, X } from 'lucide-react'
import { ipc } from '@/lib/ipc'
import { isElectron } from '@/lib/platform'
import { getIpcErrorMessage } from '@/lib/errors'
import { useTimerStore } from '@/stores/timerStore'
import { formatSeconds, getTimerTotalSeconds } from '@/lib/timer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { EmptyState } from '@/components/shared/EmptyState'
import { InlineLoader } from '@/components/shared/PageLoader'

const ENTITY_LABEL: Record<'ticket' | 'project_task', string> = {
  ticket: 'Ticket',
  project_task: 'Tarefa',
}

function parseError(error: unknown): string {
  return getIpcErrorMessage(error, {
    overrides: {
      UNAUTHORIZED: 'Sessão inválida. Faça login na janela principal.',
      FORBIDDEN: 'Você não pode operar este cronômetro.',
    },
    fallback: 'Não foi possível concluir a operação.',
  })
}

export default function FloatingTimerPage(): JSX.Element {
  const timers = useTimerStore((state) => state.timers)
  const setTimers = useTimerStore((state) => state.setTimers)
  const pinnedToSidebar = useTimerStore((state) => state.pinnedToSidebar)
  const setPinnedToSidebar = useTimerStore((state) => state.setPinnedToSidebar)

  const [error, setError] = useState<string | null>(null)
  const [pinned, setPinned] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void ipc
      .getActiveTimers()
      .then(setTimers)
      .catch((err) => setError(parseError(err)))
      .finally(() => setLoading(false))

    const unsubscribe = ipc.onTimerTick((items) => {
      setTimers(items)
    })

    return () => {
      unsubscribe()
    }
  }, [setTimers])

  async function handlePause(timerId: string): Promise<void> {
    setError(null)
    try {
      await ipc.pauseTimer(timerId)
      const result = await ipc.getActiveTimers()
      setTimers(result)
    } catch (err) {
      setError(parseError(err))
    }
  }

  async function handleResume(
    entityId: string,
    entityType: 'ticket' | 'project_task',
    entityTitle: string,
  ): Promise<void> {
    setError(null)
    try {
      await ipc.startTimer(entityId, entityType, entityTitle)
      const result = await ipc.getActiveTimers()
      setTimers(result)
    } catch (err) {
      setError(parseError(err))
    }
  }

  async function handleStop(timerId: string): Promise<void> {
    setError(null)
    try {
      await ipc.stopTimer(timerId)
      const result = await ipc.getActiveTimers()
      setTimers(result)
    } catch (err) {
      setError(parseError(err))
    }
  }

  async function handleToggleSidebarPin(): Promise<void> {
    setPinnedToSidebar(!pinnedToSidebar)
  }

  async function handleTogglePin(): Promise<void> {
    try {
      const next = await ipc.toggleFloatingPin(!pinned)
      setPinned(next)
    } catch (err) {
      setError(parseError(err))
    }
  }

  async function handleCloseWindow(): Promise<void> {
    await ipc.closeFloatingWindow()
  }

  const runningCount = useMemo(
    () => timers.filter((timer) => timer.state === 'running').length,
    [timers],
  )

  return (
    <div className="flex h-screen flex-col bg-background p-3 text-foreground">
      <header className="mb-3 flex items-center justify-between rounded-lg border bg-card px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Timer className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-sm font-semibold leading-none">Cronômetros</h1>
            <p className="mt-1 text-xs text-muted-foreground">{runningCount} em andamento</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant={pinnedToSidebar ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            aria-label={pinnedToSidebar ? 'Remover da barra lateral' : 'Fixar na barra lateral'}
            onClick={() => void handleToggleSidebarPin()}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          {isElectron() ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={pinned ? 'Desfixar janela' : 'Fixar janela'}
              onClick={() => void handleTogglePin()}
            >
              {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Fechar janela"
            onClick={() => void handleCloseWindow()}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {error ? <StatusAlert variant="error" message={error} className="mb-2" /> : null}

      <div className="flex-1 space-y-2 overflow-auto">
        {loading ? (
          <InlineLoader rows={2} />
        ) : timers.length === 0 ? (
          <EmptyState
            icon={Timer}
            title="Nenhum cronômetro ativo"
            description="Inicie um cronômetro em um ticket ou tarefa."
          />
        ) : (
          timers.map((timer) => (
            <section key={timer.id} className="rounded-lg border bg-card p-3 shadow-sm">
              <p className="line-clamp-2 text-xs font-medium">{timer.entityTitle}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  {ENTITY_LABEL[timer.entityType]}
                </Badge>
                <Badge
                  variant={timer.state === 'running' ? 'default' : 'secondary'}
                  className="text-[10px]"
                >
                  {timer.state === 'running' ? 'Rodando' : 'Pausado'}
                </Badge>
              </div>
              <p className="mt-2 font-mono text-xl font-semibold leading-none">
                {formatSeconds(getTimerTotalSeconds(timer))}
              </p>

              <div className="mt-3 flex gap-2">
                {timer.state === 'running' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 gap-1.5"
                    onClick={() => void handlePause(timer.id)}
                  >
                    <Pause className="h-3.5 w-3.5" />
                    Pausar
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 gap-1.5"
                    onClick={() =>
                      void handleResume(timer.entityId, timer.entityType, timer.entityTitle)
                    }
                  >
                    <Play className="h-3.5 w-3.5" />
                    Retomar
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 flex-1 gap-1.5"
                  onClick={() => void handleStop(timer.id)}
                >
                  <Square className="h-3.5 w-3.5" />
                  Parar
                </Button>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
