/**
 * src/App.tsx — Componente raiz da aplicação
 */

import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { useTimerStore } from './stores/timerStore'
import { useAuthStore } from './stores/authStore'
import { ipc } from './lib/ipc'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function App(): JSX.Element {
  const setTimers = useTimerStore((s) => s.setTimers)
  const completeSessionCheck = useAuthStore((s) => s.completeSessionCheck)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isSessionReady = useAuthStore((s) => s.isSessionReady)

  useEffect(() => {
    ipc
      .getSession()
      .then((session) => completeSessionCheck(session?.user ?? null))
      .catch(() => completeSessionCheck(null))
  }, [completeSessionCheck])

  useEffect(() => {
    if (!isSessionReady || !isAuthenticated) return

    ipc.getActiveTimers().then(setTimers).catch(console.error)

    const unsubscribe = ipc.onTimerTick(setTimers)
    return unsubscribe
  }, [isSessionReady, isAuthenticated, setTimers])

  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} />
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
