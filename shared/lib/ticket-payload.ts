import type { CreateTicketPayload } from '../../shared/types'

function resolveRequesterEmail(payload: CreateTicketPayload): string {
  const email = payload.requesterEmail?.trim().toLowerCase()
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return email
  if (payload.requesterUserId) return `${payload.requesterUserId}@gestec.local`
  return 'solicitante@gestec.local'
}

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
  clean.requesterEmail = resolveRequesterEmail(clean)

  return clean
}
