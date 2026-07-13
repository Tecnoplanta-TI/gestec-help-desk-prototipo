import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Asterisk,
  Bot,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  FileText,
  LogOut,
  Moon,
  Settings2,
  Sun,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ipc } from '@/lib/ipc'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarTimerPanel } from '@/components/layout/SidebarTimerPanel'

interface ExternalGestecLink {
  label: string
  href: string
  icon: LucideIcon
}

interface HelpDeskNavItem {
  label: string
  to: string
}

export const EXTERNAL_GESTEC_LINKS: ExternalGestecLink[] = [
  { label: 'Exemplo', href: '#', icon: Bot },
  { label: 'Exemplo', href: '#', icon: BookOpen },
  { label: 'Exemplo', href: '#', icon: Settings2 },
]

export const HELP_DESK_NAV: HelpDeskNavItem[] = [
  { label: 'Tickets', to: '/tickets' },
  { label: 'Kanban', to: '/tickets/kanban' },
  { label: 'Acompanhar solicitações', to: '/tickets/mine' },
  { label: 'Integrações', to: '/settings/integrations' },
]

const HELP_DESK_OPEN_KEY = 'gestec.sidebar.helpDeskOpen'

function getInitialOpenState(): boolean {
  if (typeof window === 'undefined') return true
  const stored = localStorage.getItem(HELP_DESK_OPEN_KEY)
  return stored === null ? true : stored === 'true'
}

function BrandHeader(): JSX.Element {
  return (
    <div className="flex h-20 items-center px-5">
      <div className="flex items-center gap-2.5">
        <Asterisk className="h-7 w-7 text-emerald-500" strokeWidth={3} aria-hidden />
        <span className="text-3xl font-medium tracking-normal text-foreground">gestec</span>
      </div>
    </div>
  )
}

function isActivePath(pathname: string, to: string): boolean {
  if (to === '/tickets') return pathname === '/tickets'
  if (to === '/settings/integrations') {
    return pathname === '/settings/integrations' || pathname.startsWith('/settings/integrations/')
  }
  return pathname === to
}

function UserFooter(): JSX.Element {
  const user = useAuthStore((s) => s.user)
  const completeSessionCheck = useAuthStore((s) => s.completeSessionCheck)
  const { theme, toggleTheme } = useThemeStore()

  const initials =
    user?.name
      ?.split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? '?'

  async function handleLogout(): Promise<void> {
    await ipc.logout()
    const session = await ipc.getSession()
    completeSessionCheck(session?.user ?? null)
    window.dispatchEvent(new CustomEvent('gestec-help-desk:logout'))
  }

  return (
    <div className="border-t border-[hsl(var(--sidebar-border))] p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-3 px-2 py-2 text-left"
            aria-label="Abrir menu do usuário"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user?.name ?? 'Usuário'}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {user?.email ?? 'usuario@gestec.local'}
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56">
          <DropdownMenuLabel>
            <p className="font-medium">{user?.name ?? 'Usuário'}</p>
            <p className="text-xs font-normal text-muted-foreground">
              {user?.email ?? 'usuario@gestec.local'}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={toggleTheme}>
            {theme === 'dark' ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleLogout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }): JSX.Element {
  const location = useLocation()
  const [helpDeskOpen, setHelpDeskOpen] = useState(getInitialOpenState)

  useEffect(() => {
    localStorage.setItem(HELP_DESK_OPEN_KEY, String(helpDeskOpen))
  }, [helpDeskOpen])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      <BrandHeader />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4">
        <nav className="space-y-1" aria-label="Navegação gestec">
          {EXTERNAL_GESTEC_LINKS.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={`${item.label}-${item.href}-${Icon.displayName ?? Icon.name}`}
                asChild
                variant="ghost"
                className="h-9 w-full justify-start gap-3 px-2 text-sm font-normal text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              >
                <a href={item.href} aria-label={`${item.label} do ecossistema gestec`}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                  <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                </a>
              </Button>
            )
          })}
        </nav>

        <Collapsible open={helpDeskOpen} onOpenChange={setHelpDeskOpen} className="mt-1">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="h-9 w-full justify-start gap-3 px-2 text-sm font-normal hover:bg-sidebar-accent"
              aria-label={helpDeskOpen ? 'Recolher Gestec Help Desk' : 'Expandir Gestec Help Desk'}
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">Gestec Help Desk</span>
              {helpDeskOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="ml-4 border-l border-[hsl(var(--sidebar-border))] py-1 pl-3">
              {HELP_DESK_NAV.map((item) => {
                const active = isActivePath(location.pathname, item.to)
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'block rounded-md px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'bg-sidebar-accent font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground',
                      )}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </CollapsibleContent>
        </Collapsible>

        <div className="mt-auto pt-8">
          <SidebarTimerPanel />
        </div>
      </div>

      <UserFooter />
    </div>
  )
}
