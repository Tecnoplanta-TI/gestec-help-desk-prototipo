import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useThemeStore } from '@/stores/themeStore'

interface ThemeProviderProps {
  children: ReactNode
}

/** Sincroniza a classe `dark` no `<html>` com o store persistido */
export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  }, [theme])

  return <>{children}</>
}
