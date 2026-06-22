import { getContainer } from './cosmos'

const CONTAINER = 'ticket_counters'
const DOC_ID = 'ticket_number'

interface TicketCounterDoc {
  id: string
  year: number
  sequence: number
}

export async function generateTicketNumber(): Promise<string> {
  const container = await getContainer(CONTAINER)
  const year = new Date().getFullYear()

  try {
    const { resource } = await container.item(DOC_ID, DOC_ID).read<TicketCounterDoc>()
    if (resource && resource.year === year) {
      const next = resource.sequence + 1
      await container.item(DOC_ID, DOC_ID).replace<TicketCounterDoc>({
        id: DOC_ID,
        year,
        sequence: next,
      })
      return formatTicketNumber(year, next)
    }
  } catch {
    // first run or new year
  }

  await container.items.upsert<TicketCounterDoc>({
    id: DOC_ID,
    year,
    sequence: 1,
  })
  return formatTicketNumber(year, 1)
}

function formatTicketNumber(year: number, sequence: number): string {
  return `TKT-${year}-${String(sequence).padStart(5, '0')}`
}
