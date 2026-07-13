import { lazy, Suspense } from 'react'
import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PageLoader } from './components/shared/PageLoader'

const RootLayout = lazy(() => import('./components/layout/RootLayout'))
const TicketListPage = lazy(() => import('./pages/tickets/TicketListPage'))
const TicketKanbanPage = lazy(() => import('./pages/tickets/TicketKanbanPage'))
const TicketDetailPage = lazy(() => import('./pages/tickets/TicketDetailPage'))
const ProjectListPage = lazy(() => import('./pages/projects/ProjectListPage'))
const ProjectDetailPage = lazy(() => import('./pages/projects/ProjectDetailPage'))
const TriagePage = lazy(() => import('./pages/triage/TriagePage'))
const TriageDetailPage = lazy(() => import('./pages/triage/TriageDetailPage'))
const ServicePage = lazy(() => import('./pages/service/ServicePage'))
const ServiceDetailPage = lazy(() => import('./pages/service/ServiceDetailPage'))
const CompletionPage = lazy(() => import('./pages/completion/CompletionPage'))
const CompletionDetailPage = lazy(() => import('./pages/completion/CompletionDetailPage'))
const ApprovalsItPage = lazy(() => import('./pages/approvals/ApprovalsItPage'))
const ApprovalsAppPage = lazy(() => import('./pages/approvals/ApprovalsAppPage'))
const CancellationApprovalsPage = lazy(() => import('./pages/approvals/CancellationApprovalsPage'))
const ReportsDashboardPage = lazy(() => import('./pages/reports/ReportsDashboardPage'))
const BillingReportPage = lazy(() => import('./pages/reports/BillingReportPage'))
const TicketEvaluationPage = lazy(() => import('./pages/tickets/TicketEvaluationPage'))
const WorkflowsPage = lazy(() => import('./pages/settings/WorkflowsPage'))
const UsersPage = lazy(() => import('./pages/settings/UsersPage'))
const RatesPage = lazy(() => import('./pages/settings/RatesPage'))
const SlaPage = lazy(() => import('./pages/settings/SlaPage'))
const DiscordNotificationsPage = lazy(() => import('./pages/settings/DiscordNotificationsPage'))
const ApiIntegrationsListPage = lazy(() => import('./pages/settings/ApiIntegrationsListPage'))
const ApiIntegrationDetailPage = lazy(() => import('./pages/settings/ApiIntegrationDetailPage'))

function withSuspense(Component: ComponentType): JSX.Element {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  )
}

const routes = [
  {
    path: '/',
    element: withSuspense(RootLayout),
    children: [
      { index: true, element: <Navigate to="/tickets" replace /> },
      { path: 'tickets', element: withSuspense(TicketListPage) },
      { path: 'tickets/mine', element: withSuspense(TicketListPage) },
      { path: 'tickets/kanban', element: withSuspense(TicketKanbanPage) },
      { path: 'tickets/:id/evaluate', element: withSuspense(TicketEvaluationPage) },
      { path: 'tickets/:id', element: withSuspense(TicketDetailPage) },
      { path: 'triage', element: withSuspense(TriagePage) },
      { path: 'triage/:id', element: withSuspense(TriageDetailPage) },
      { path: 'service', element: withSuspense(ServicePage) },
      { path: 'service/:id', element: withSuspense(ServiceDetailPage) },
      { path: 'completion', element: withSuspense(CompletionPage) },
      { path: 'completion/:id', element: withSuspense(CompletionDetailPage) },
      { path: 'approvals/it', element: withSuspense(ApprovalsItPage) },
      { path: 'approvals/app', element: withSuspense(ApprovalsAppPage) },
      { path: 'approvals/cancellation', element: withSuspense(CancellationApprovalsPage) },
      { path: 'projects', element: withSuspense(ProjectListPage) },
      { path: 'projects/:id', element: withSuspense(ProjectDetailPage) },
      { path: 'reports/dashboard', element: withSuspense(ReportsDashboardPage) },
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
          { path: 'integrations/new', element: withSuspense(ApiIntegrationDetailPage) },
          { path: 'integrations/:id', element: withSuspense(ApiIntegrationDetailPage) },
          { path: 'integrations', element: withSuspense(ApiIntegrationsListPage) },
        ],
      },
      { path: '*', element: <Navigate to="/tickets" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
