/**
 * src/stores/authStore.ts
 *
 * Estado global de autenticação via Zustand.
 * O token real fica apenas no Main Process (electron-store).
 */

import { create } from 'zustand'
import type { User } from '../../shared/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isSessionReady: boolean
  isLoading: boolean

  setAuth: (user: User) => void
  completeSessionCheck: (user: User | null) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isSessionReady: false,
  isLoading: false,

  setAuth: (user) =>
    set({ user, isAuthenticated: true, isLoading: false, isSessionReady: true }),

  completeSessionCheck: (user) =>
    set({
      user,
      isAuthenticated: Boolean(user),
      isSessionReady: true,
      isLoading: false,
    }),

  clearAuth: () =>
    set({ user: null, isAuthenticated: false, isLoading: false, isSessionReady: true }),

  setLoading: (isLoading) => set({ isLoading }),
}))
