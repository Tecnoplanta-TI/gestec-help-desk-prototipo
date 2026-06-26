import { useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Clock,
  Columns3,
  FolderKanban,
  GitBranch,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Plug,
  Sun,
  Ticket,
  Timer,
  CheckCircle2,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ipc } from '@/lib/ipc'
import { isElectron } from '@/lib/platform'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PageLoader } from '@/components/shared/PageLoader'
import { SidebarTimerPanel } from '@/components/layout/SidebarTimerPanel'
import { useTimerStore } from '@/stores/timerStore'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { to: '/tickets', label: 'Acompanhar solicitações', icon: Ticket },
      { to: '/tickets/mine', label: 'Minhas solicitações', icon: Ticket },
      { to: '/tickets/kanban', label: 'Kanban', icon: Columns3 },
      { to: '/projects', label: 'Projetos', icon: FolderKanban },
      { to: '/reports/dashboard', label: 'Indicadores', icon: BarChart3 },
      { to: '/reports/billing', label: 'Faturamento', icon: BarChart3 },
    ],
  },
  {
    title: 'Fluxo Zeev',
    items: [
      { to: '/approvals/it', label: 'Aprovações TI', icon: GitBranch },
      { to: '/approvals/app', label: 'Aprovações App', icon: GitBranch },
      { to: '/triage', label: 'Triagem', icon: Columns3 },
      { to: '/service', label: 'Atendimento', icon: Timer },
      { to: '/completion', label: 'Aprovar conclusão', icon: CheckCircle2 },
      { to: '/approvals/cancellation', label: 'Cancelamentos', icon: MessageSquare },
    ],
  },
  {
    title: 'Configurações',
    items: [
      { to: '/settings/users', label: 'Usuários', icon: Users },
      { to: '/settings/workflows', label: 'Workflows', icon: GitBranch },
      { to: '/settings/sla', label: 'SLA', icon: Clock },
      { to: '/settings/discord', label: 'Discord', icon: MessageSquare },
      { to: '/settings/integrations', label: 'Integrações', icon: Plug },
    ],
  },
]

function BrandMark(): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
        g
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight">gestec · help desk</p>
        <p className="truncate text-xs text-muted-foreground">Tecnoplanta</p>
      </div>
    </div>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }): JSX.Element {
  const location = useLocation()

  function isActive(to: string): boolean {
    if (to === '/tickets') return location.pathname === '/tickets'
    return location.pathname.startsWith(to)
  }

  return (
    <nav className="flex flex-col gap-6" aria-label="Navegação principal">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(item.to)
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={cn('nav-item', active ? 'nav-item-active' : 'nav-item-inactive')}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {item.label}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export default function RootLayout(): JSX.Element {
  const navigate = useNavigate()
  const { user, isAuthenticated, isSessionReady, clearAuth } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const pinnedToSidebar = useTimerStore((s) => s.pinnedToSidebar)
  const setPinnedToSidebar = useTimerStore((s) => s.setPinnedToSidebar)

  const initials = user?.name
    ?.split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  async function handleLogout(): Promise<void> {
    try {
      await ipc.logout()
    } finally {
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  async function handleOpenFloating(): Promise<void> {
    await ipc.openFloatingWindow()
  }

  if (!isSessionReady) {
    return <PageLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {/* Sidebar desktop */}
        <aside
          className="hidden w-[260px] shrink-0 flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] md:flex"
          aria-label="Barra lateral"
        >
          <div className="border-b border-[hsl(var(--sidebar-border))] p-5">
            <BrandMark />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <SidebarNav />
            <SidebarTimerPanel />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              {/* Menu mobile */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-0">
                  <SheetHeader className="border-b p-5 text-left">
                    <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
                    <BrandMark />
                  </SheetHeader>
                  <div className="p-4">
                    <SidebarNav onNavigate={() => setMobileOpen(false)} />
                    <SidebarTimerPanel />
                  </div>
                </SheetContent>
              </Sheet>

              <div className="min-w-0 md:hidden">
                <p className="truncate text-sm font-medium">{user?.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={pinnedToSidebar ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setPinnedToSidebar(!pinnedToSidebar)}
                    aria-label={pinnedToSidebar ? 'Ocultar timer na barra' : 'Fixar timer na barra lateral'}
                  >
                    <Timer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {pinnedToSidebar ? 'Ocultar cronômetro na barra' : 'Fixar cronômetro na barra lateral'}
                </TooltipContent>
              </Tooltip>

              {isElectron() ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleOpenFloating()}
                      aria-label="Abrir timer flutuante"
                    >
                      <Timer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Timer flutuante</TooltipContent>
                </Tooltip>
              ) : null}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
                  >
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="hidden gap-2 px-2 sm:inline-flex">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden text-left lg:block">
                      <p className="max-w-[140px] truncate text-sm font-medium">{user?.name}</p>
                      <p className="max-w-[140px] truncate text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isElectron() ? (
                    <DropdownMenuItem onClick={() => void handleOpenFloating()}>
                      <Timer className="mr-2 h-4 w-4" />
                      Timer flutuante
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onClick={toggleTheme}>
                    {theme === 'dark' ? (
                      <Sun className="mr-2 h-4 w-4" />
                    ) : (
                      <Moon className="mr-2 h-4 w-4" />
                    )}
                    {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => void handleLogout()}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <div className="page-content mx-auto max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
  )
}
