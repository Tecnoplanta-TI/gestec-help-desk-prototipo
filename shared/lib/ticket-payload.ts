import type { CreateTicketPayload } from '../../shared/types'

/** Remove strings vazias de campos opcionais antes de enviar ao IPC (evita falha de UUID no Zod). */
export function sanitizeCreateTicketPayload(payload: CreateTicketPayload): CreateTicketPayload {
  const clean = { ...payload }

  const optionalStrings: (keyof CreateTicketPayload)[] = [
    'requesterUserId',
    'appManagerId',
    'cancellationApproverId',
    'assetCode',
    'supportNotes',
    'applicationProcess',
  ]

  for (const key of optionalStrings) {
    const value = clean[key]
    if (value === '' || value === null) {
      delete clean[key]
    }
  }

  if (clean.title?.trim() === '') {
    clean.title = clean.description.trim().slice(0, 200) || 'Solicitação'
  }

  clean.title = clean.title.trim()
  clean.description = clean.description.trim()
  clean.requesterName = clean.requesterName.trim()
  clean.requesterEmail = clean.requesterEmail.trim().toLowerCase()

  return clean
}
