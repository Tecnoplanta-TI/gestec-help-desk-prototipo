import TicketQueuePage from '../tickets/TicketQueuePage'

export default function CompletionPage(): JSX.Element {
  return (
    <TicketQueuePage
      queue="completion"
      ticketLinkPath={(id) => `/completion/${id}`}
    />
  )
}
