import { create } from 'zustand'
import type { User } from '../../shared/types'

interface AuthState {
  user: User | null
  isSessionReady: boolean
  completeSessionCheck: (user: User | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isSessionReady: false,

  completeSessionCheck: (user) =>
    set({
      user,
      isSessionReady: true,
    }),
}))
