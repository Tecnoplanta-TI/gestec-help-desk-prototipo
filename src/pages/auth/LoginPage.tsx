import { FormEvent, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Headphones, Moon, Sun } from 'lucide-react'
import { ipc } from '@/lib/ipc'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { PageLoader } from '@/components/shared/PageLoader'

function mapLoginError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('INVALID_CREDENTIALS')) return 'E-mail ou senha incorretos.'
  if (message.includes('ACCOUNT_DISABLED')) return 'Conta desativada. Contate o administrador.'
  if (message.includes('RATE_LIMIT_EXCEEDED')) {
    return 'Muitas tentativas de login. Tente novamente em alguns minutos.'
  }
  return 'Não foi possível realizar login. Tente novamente.'
}

export default function LoginPage(): JSX.Element {
  const navigate = useNavigate()
  const { isAuthenticated, isSessionReady, isLoading, setLoading, setAuth } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isFormValid = useMemo(() => email.trim().length > 0 && password.length > 0, [email, password])

  if (!isSessionReady) {
    return <PageLoader />
  }

  if (isAuthenticated) {
    return <Navigate to="/tickets" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!isFormValid || isLoading) return

    setError(null)
    setLoading(true)

    try {
      const result = await ipc.login(email.trim().toLowerCase(), password)
      setAuth(result.user)
      navigate('/tickets', { replace: true })
    } catch (err) {
      setError(mapLoginError(err))
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Fundo com gradiente sutil — sensação premium sem poluir */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/30"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl"
        aria-hidden
      />

      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      <div className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-500">
        <Card className="border-border/60 shadow-xl shadow-primary/5">
          <CardHeader className="space-y-4 text-center sm:text-left">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md sm:mx-0">
              <Headphones className="h-6 w-6" aria-hidden />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-2xl tracking-tight">gestec · help desk</CardTitle>
              <CardDescription className="text-base">
                Central de suporte técnico da Tecnoplanta
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error ? <StatusAlert variant="error" message={error} /> : null}

              <Button type="submit" className="w-full" disabled={!isFormValid || isLoading}>
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Problemas para acessar? Contate o administrador do sistema.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
