import type { ActiveTimer } from '../../shared/types'

export function getTimerTotalSeconds(timer: ActiveTimer): number {
  if (timer.state !== 'running') {
    return timer.accumulatedSeconds
  }

  const startedAtMs = new Date(timer.startedAt).getTime()
  const nowMs = Date.now()
  const elapsed = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))
  return timer.accumulatedSeconds + elapsed
}

export function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}