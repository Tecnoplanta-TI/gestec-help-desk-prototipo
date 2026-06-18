/**
 * src/stores/timerStore.ts
 *
 * Estado global dos cronômetros ativos via Zustand.
 * Sincronizado com o Main Process via IPC (evento 'timer:tick').
 * Permite múltiplos cronômetros rodando simultaneamente.
 */

import { create } from 'zustand'
import type { ActiveTimer } from '../../shared/types'

interface TimerState {
  timers: ActiveTimer[]
  setTimers: (timers: ActiveTimer[]) => void
  upsertTimer: (timer: ActiveTimer) => void
  removeTimer: (timerId: string) => void
}

export const useTimerStore = create<TimerState>((set) => ({
  timers: [],

  /** Substitui todos os timers (recebido via IPC tick) */
  setTimers: (timers) => set({ timers }),

  /** Insere ou atualiza um timer específico */
  upsertTimer: (timer) =>
    set((state) => {
      const exists = state.timers.some((t) => t.id === timer.id)
      if (exists) {
        return { timers: state.timers.map((t) => (t.id === timer.id ? timer : t)) }
      }
      return { timers: [...state.timers, timer] }
    }),

  /** Remove um timer da lista (após stop) */
  removeTimer: (timerId) =>
    set((state) => ({
      timers: state.timers.filter((t) => t.id !== timerId),
    })),
}))
