import { randomUUID } from 'crypto'
import type { AuditLog } from '../../shared/types'
import { getContainer } from './cosmos'

const CONTAINER = 'audit_logs'

export interface WriteAuditLogInput {
  entityType: AuditLog['entityType']
  entityId: string
  action: string
  userId: string
  field?: string
  oldValue?: string
  newValue?: string
  workflowStep?: string
  justification?: string
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<AuditLog> {
  const container = await getContainer(CONTAINER)
  const entry: AuditLog = {
    id: randomUUID(),
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    field: input.field,
    oldValue: input.oldValue,
    newValue: input.newValue,
    userId: input.userId,
    workflowStep: input.workflowStep,
    justification: input.justification,
    createdAt: new Date().toISOString(),
  }
  const { resource } = await container.items.create(entry)
  return resource as AuditLog
}

export async function listAuditLogs(entityId: string): Promise<AuditLog[]> {
  const container = await getContainer(CONTAINER)
  const { resources } = await container.items
    .query<AuditLog>({
      query: 'SELECT * FROM c WHERE c.entityId = @entityId ORDER BY c.createdAt DESC',
      parameters: [{ name: '@entityId', value: entityId }],
    })
    .fetchAll()
  return resources
}
