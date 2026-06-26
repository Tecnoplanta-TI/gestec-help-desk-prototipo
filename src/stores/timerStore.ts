/**
 * src/stores/timerStore.ts
 *
 * Estado global dos cronômetros ativos via Zustand.
 * Sincronizado com o Main Process via IPC (evento 'timer:tick').
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActiveTimer } from '../../shared/types'

function defaultPinnedToSidebar(): boolean {
  if (typeof window === 'undefined') return false
  return !window.electronAPI
}

interface TimerState {
  timers: ActiveTimer[]
  pinnedToSidebar: boolean
  setTimers: (timers: ActiveTimer[]) => void
  upsertTimer: (timer: ActiveTimer) => void
  removeTimer: (timerId: string) => void
  setPinnedToSidebar: (pinned: boolean) => void
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set) => ({
      timers: [],
      pinnedToSidebar: defaultPinnedToSidebar(),

      setTimers: (timers) => set({ timers }),

      upsertTimer: (timer) =>
        set((state) => {
          const exists = state.timers.some((t) => t.id === timer.id)
          if (exists) {
            return { timers: state.timers.map((t) => (t.id === timer.id ? timer : t)) }
          }
          return { timers: [...state.timers, timer] }
        }),

      removeTimer: (timerId) =>
        set((state) => ({
          timers: state.timers.filter((t) => t.id !== timerId),
        })),

      setPinnedToSidebar: (pinned) => set({ pinnedToSidebar: pinned }),
    }),
    {
      name: 'gestec-timer-ui',
      version: 1,
      migrate: (persistedState, version) => {
        if (version < 1 && typeof window !== 'undefined' && !window.electronAPI) {
          return { pinnedToSidebar: true }
        }
        return persistedState as { pinnedToSidebar: boolean }
      },
      partialize: (state) => ({ pinnedToSidebar: state.pinnedToSidebar }),
    },
  ),
)
