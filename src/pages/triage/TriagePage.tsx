import TicketQueuePage from '../tickets/TicketQueuePage'

export default function TriagePage(): JSX.Element {
  return <TicketQueuePage queue="triage" ticketLinkPath={(id) => `/triage/${id}`} />
}
