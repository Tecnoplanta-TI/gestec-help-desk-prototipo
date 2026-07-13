import { describe, expect, it } from 'vitest'
import {
  formatPublicTicketId,
  getNextPublicTicketId,
  getTicketDisplayId,
  isPublicTicketId,
} from './ticket-public-id'

describe('ticket-public-id', () => {
  it('aceita somente IDs públicos no formato # seguido por 1 a 9 dígitos', () => {
    expect(isPublicTicketId('#1')).toBe(true)
    expect(isPublicTicketId('#123456789')).toBe(true)
    expect(isPublicTicketId('GHD-2026-0001')).toBe(false)
    expect(isPublicTicketId('#ABC')).toBe(false)
    expect(isPublicTicketId('#1234567890')).toBe(false)
  })

  it('gera o próximo número público sem reutilizar números existentes', () => {
    expect(getNextPublicTicketId([{ ticketNumber: '#1' }, { ticketNumber: '#3' }])).toBe('#2')
  })

  it('exibe somente o número público validado', () => {
    expect(getTicketDisplayId({ id: 'internal-id', ticketNumber: '#42' })).toBe('#42')
    expect(getTicketDisplayId({ id: 'internal-id', ticketNumber: 'internal-id' })).toBe('#0')
  })

  it('mantém números dentro do intervalo público permitido', () => {
    expect(formatPublicTicketId(0)).toBe('#1')
    expect(formatPublicTicketId(1_000_000_000)).toBe('#999999999')
  })
})
