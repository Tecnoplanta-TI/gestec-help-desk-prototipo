import type { TicketService, TicketType } from '../types'

export type FormFieldKey =
  | 'service'
  | 'unavailableSystem'
  | 'inoperableInfrastructure'
  | 'downtimeMinutes'
  | 'assetCode'
  | 'applicationProcess'
  | 'improvementAcknowledged'
  | 'appManagerId'
  | 'supportNotes'
  | 'level'
  | 'cancellationItems'
  | 'cancellationApproverId'
  | 'directCancellation'

export function getVisibleFields(
  type: TicketType,
  service?: TicketService,
): Set<FormFieldKey> {
  const visible = new Set<FormFieldKey>()

  if (type === 'improvement') {
    visible.add('applicationProcess')
    visible.add('improvementAcknowledged')
    visible.add('appManagerId')
    return visible
  }

  if (type === 'cancellation') {
    visible.add('cancellationItems')
    visible.add('cancellationApproverId')
    visible.add('directCancellation')
    return visible
  }

  if (type === 'service_interruption') {
    visible.add('service')
    visible.add('downtimeMinutes')
  }

  if (type === 'incident') {
    visible.add('service')
    visible.add('assetCode')
    visible.add('supportNotes')
    visible.add('level')
  }

  if (service === 'system') {
    visible.add('unavailableSystem')
  }
  if (service === 'infrastructure') {
    visible.add('inoperableInfrastructure')
  }

  return visible
}

export function getRequiredFields(
  type: TicketType,
  service?: TicketService,
): Set<FormFieldKey> {
  const required = new Set<FormFieldKey>()
  const visible = getVisibleFields(type, service)

  for (const field of visible) {
    if (field === 'directCancellation' || field === 'cancellationApproverId') continue
    if (field === 'assetCode' || field === 'supportNotes' || field === 'level') continue
    required.add(field)
  }

  if (type === 'improvement') {
    required.add('improvementAcknowledged')
    required.add('applicationProcess')
    required.add('appManagerId')
  }

  if (type === 'cancellation') {
    required.add('cancellationItems')
  }

  return required
}

export function isFieldVisible(
  field: FormFieldKey,
  type: TicketType,
  service?: TicketService,
): boolean {
  return getVisibleFields(type, service).has(field)
}
