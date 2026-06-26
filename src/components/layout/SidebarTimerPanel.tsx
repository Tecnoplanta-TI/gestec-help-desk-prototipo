import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Pause, Play, Square, Timer, X } from 'lucide-react'
import { ipc } from '@/lib/ipc'
import { formatSeconds, getTimerTotalSeconds } from '@/lib/timer'
import { useTimerStore } from '@/stores/timerStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const ENTITY_LABEL: Record<'ticket' | 'project_task', string> = {
  ticket: 'Ticket',
  project_task: 'Tarefa',
}

export function SidebarTimerPanel(): JSX.Element | null {
  const pinnedToSidebar = useTimerStore((s) => s.pinnedToSidebar)
  const setPinnedToSidebar = useTimerStore((s) => s.setPinnedToSidebar)
  const timers = useTimerStore((s) => s.timers)
  const setTimers = useTimerStore((s) => s.setTimers)

  useEffect(() => {
    if (!pinnedToSidebar) return

    void ipc.getActiveTimers().then(setTimers).catch(() => undefined)
    const unsubscribe = ipc.onTimerTick((items) => setTimers(items))
    return () => unsubscribe()
  }, [pinnedToSidebar, setTimers])

  if (!pinnedToSidebar) return null

  async function refreshTimers(): Promise<void> {
    const result = await ipc.getActiveTimers()
    setTimers(result)
  }

  async function handlePause(timerId: string): Promise<void> {
    await ipc.pauseTimer(timerId)
    await refreshTimers()
  }

  async function handleResume(
    entityId: string,
    entityType: 'ticket' | 'project_task',
    entityTitle: string,
  ): Promise<void> {
    await ipc.startTimer(entityId, entityType, entityTitle)
    await refreshTimers()
  }

  async function handleStop(timerId: string): Promise<void> {
    await ipc.stopTimer(timerId)
    await refreshTimers()
  }

  return (
    <div className="mt-4 rounded-lg border border-[hsl(var(--sidebar-border))] bg-background/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Timer className="h-4 w-4 text-primary" />
          Cronômetros
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Remover da barra lateral"
          onClick={() => setPinnedToSidebar(false)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {timers.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum cronômetro ativo.</p>
      ) : (
        <div className="space-y-2">
          {timers.map((timer) => (
            <div key={timer.id} className="rounded-md border bg-card p-2">
              <p className="line-clamp-2 text-xs font-medium">{timer.entityTitle}</p>
              <div className="mt-1 flex items-center gap-1">
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
              <p className="mt-1 font-mono text-lg font-semibold leading-none">
                {formatSeconds(getTimerTotalSeconds(timer))}
              </p>
              <div className="mt-2 flex gap-1">
                {timer.state === 'running' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 px-2"
                    onClick={() => void handlePause(timer.id)}
                  >
                    <Pause className="h-3 w-3" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 px-2"
                    onClick={() =>
                      void handleResume(timer.entityId, timer.entityType, timer.entityTitle)
                    }
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-7 flex-1 px-2"
                  onClick={() => void handleStop(timer.id)}
                >
                  <Square className="h-3 w-3" />
                </Button>
              </div>
              {timer.entityType === 'ticket' ? (
                <Link
                  to={`/service/${timer.entityId}`}
                  className="mt-2 block text-[11px] text-primary hover:underline"
                >
                  Abrir ticket
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
