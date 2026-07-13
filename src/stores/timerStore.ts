import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActiveTimer } from '../../shared/types'

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
      pinnedToSidebar: true,

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
      partialize: (state) => ({ pinnedToSidebar: state.pinnedToSidebar }),
    },
  ),
)
