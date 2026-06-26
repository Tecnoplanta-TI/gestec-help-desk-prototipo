import { registerAuthHandlers } from '../ipc/auth-ipc'
import { registerTicketHandlers } from '../ipc/ticket-ipc'
import { registerSlaHandlers } from '../ipc/sla-ipc'
import { registerWorkflowHandlers } from '../ipc/workflow-ipc'
import { registerTimerHandlers } from '../ipc/timer-ipc'
import { registerDiscordHandlers } from '../ipc/discord-ipc'
import { registerProjectHandlers } from '../ipc/project-ipc'
import { registerZeevHandlers } from '../ipc/zeev-ipc'
import { registerApiIntegrationHandlers } from '../ipc/api-integration-ipc'
import { ensureZeevDefaultWorkflow } from '../services/zeev-workflow-seed'

let bootstrapped = false

/** Registra handlers IPC e dados iniciais (Electron e servidor web). */
export async function bootstrapBackend(): Promise<void> {
  if (bootstrapped) return
  bootstrapped = true

  registerAuthHandlers()
  registerTicketHandlers()
  registerSlaHandlers()
  registerWorkflowHandlers()
  registerTimerHandlers()
  registerDiscordHandlers()
  registerProjectHandlers()
  registerZeevHandlers()
  registerApiIntegrationHandlers()

  await ensureZeevDefaultWorkflow().catch((error) => {
    console.error('[bootstrap] falha ao garantir workflow Zeev:', error)
  })
}
