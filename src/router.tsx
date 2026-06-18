/**
 * src/router.tsx — Definição de rotas da aplicação
 *
 * Usa React Router v7 com lazy loading por página para reduzir o bundle
 * inicial e acelerar o primeiro render.
 *
 * Estrutura de rotas:
 * /                   → redireciona para /tickets
 * /login              → página de login (pública)
 * /tickets            → lista de tickets
 * /tickets/kanban     → visualização kanban
 * /tickets/:id        → detalhe do ticket
 * /projects           → lista de projetos
 * /projects/:id       → detalhe do projeto
 * /reports/billing    → relatório de faturamento
 * /settings/*         → configurações (usuários, workflows, SLA, Discord, valores)
 */

import { createHashRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import type { ComponentType } from 'react'
import { PageLoader } from './components/shared/PageLoader'

// Layout raiz (sidebar + header)
// Será criado na fase de UI — placeholder por enquanto
const RootLayout = lazy(() => import('./components/layout/RootLayout'))

// Páginas com lazy loading
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const TicketListPage = lazy(() => import('./pages/tickets/TicketListPage'))
const TicketKanbanPage = lazy(() => import('./pages/tickets/TicketKanbanPage'))
const TicketDetailPage = lazy(() => import('./pages/tickets/TicketDetailPage'))
const ProjectListPage = lazy(() => import('./pages/projects/ProjectListPage'))
const ProjectDetailPage = lazy(() => import('./pages/projects/ProjectDetailPage'))
const BillingReportPage = lazy(() => import('./pages/reports/BillingReportPage'))
const FloatingTimerPage = lazy(() => import('./pages/FloatingTimerPage'))
const WorkflowsPage = lazy(() => import('./pages/settings/WorkflowsPage'))
const UsersPage = lazy(() => import('./pages/settings/UsersPage'))
const RatesPage = lazy(() => import('./pages/settings/RatesPage'))
const SlaPage = lazy(() => import('./pages/settings/SlaPage'))
const DiscordNotificationsPage = lazy(() => import('./pages/settings/DiscordNotificationsPage'))

function withSuspense(Component: ComponentType): JSX.Element {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  )
}

// Usa HashRouter para compatibilidade com Electron (sem servidor HTTP para rotas)
export const router = createHashRouter([
  {
    path: '/login',
    element: withSuspense(LoginPage),
  },
  {
    path: '/floating',
    element: withSuspense(FloatingTimerPage),
  },
  {
    path: '/',
    element: withSuspense(RootLayout),
    children: [
      { index: true, element: <Navigate to="/tickets" replace /> },
      { path: 'tickets', element: withSuspense(TicketListPage) },
      { path: 'tickets/kanban', element: withSuspense(TicketKanbanPage) },
      { path: 'tickets/:id', element: withSuspense(TicketDetailPage) },
      { path: 'projects', element: withSuspense(ProjectListPage) },
      { path: 'projects/:id', element: withSuspense(ProjectDetailPage) },
      { path: 'reports/billing', element: withSuspense(BillingReportPage) },
      {
        path: 'settings',
        children: [
          { index: true, element: <Navigate to="/settings/users" replace /> },
          { path: 'users', element: withSuspense(UsersPage) },
          { path: 'workflows', element: withSuspense(WorkflowsPage) },
          { path: 'sla', element: withSuspense(SlaPage) },
          { path: 'rates', element: withSuspense(RatesPage) },
          { path: 'discord', element: withSuspense(DiscordNotificationsPage) },
        ],
      },
    ],
  },
])
