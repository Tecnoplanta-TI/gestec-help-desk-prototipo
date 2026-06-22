import TicketQueuePage from '../tickets/TicketQueuePage'

export default function ServicePage(): JSX.Element {
  return <TicketQueuePage queue="service" ticketLinkPath={(id) => `/service/${id}`} />
}
