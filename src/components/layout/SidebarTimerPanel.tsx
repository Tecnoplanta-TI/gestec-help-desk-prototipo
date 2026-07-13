import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Pause, Play, Square, Timer, X } from 'lucide-react'
import { ipc } from '@/lib/ipc'
import { formatSeconds, getTimerTotalSeconds } from '@/lib/timer'
import { useTimerStore } from '@/stores/timerStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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
    <section aria-label="Cronômetros" className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Timer className="h-4 w-4 text-emerald-500" aria-hidden />
          Cronômetros
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Ocultar cronômetros"
          onClick={() => setPinnedToSidebar(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {timers.length === 0 ? (
        <div className="rounded-lg border border-sidebar-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
          Nenhum cronômetro ativo.
        </div>
      ) : (
        <div className="space-y-2">
          {timers.map((timer) => (
            <article key={timer.id} className="rounded-lg border border-sidebar-border bg-card p-2.5 shadow-sm">
              <p className="line-clamp-2 text-xs font-medium text-card-foreground">{timer.entityTitle}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px] font-normal">
                  {ENTITY_LABEL[timer.entityType]}
                </Badge>
                <Badge
                  variant={timer.state === 'running' ? 'default' : 'secondary'}
                  className="h-5 rounded-full px-2 text-[10px] font-medium"
                >
                  {timer.state === 'running' ? 'Rodando' : 'Pausado'}
                </Badge>
              </div>
              <p className="mt-1.5 font-mono text-lg font-semibold leading-none tracking-normal text-foreground">
                {formatSeconds(getTimerTotalSeconds(timer))}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {timer.state === 'running' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    aria-label="Pausar cronômetro"
                    onClick={() => void handlePause(timer.id)}
                  >
                    <Pause className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    aria-label="Retomar cronômetro"
                    onClick={() =>
                      void handleResume(timer.entityId, timer.entityType, timer.entityTitle)
                    }
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-7 px-2"
                  aria-label="Parar cronômetro"
                  onClick={() => void handleStop(timer.id)}
                >
                  <Square className="h-3.5 w-3.5" />
                </Button>
              </div>
              {timer.entityType === 'ticket' ? (
                <Link
                  to={`/service/${timer.entityId}`}
                  className="mt-2 block text-[11px] text-emerald-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Abrir ticket
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
