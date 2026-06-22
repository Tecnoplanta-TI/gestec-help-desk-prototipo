import { useState } from 'react'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import type { TicketPriority } from '../../../shared/types'
import { PRIORITY_CRITERIA } from '@/lib/ticket-labels'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PriorityCriteriaCardProps {
  highlight?: TicketPriority
  defaultOpen?: boolean
}

export function PriorityCriteriaCard({
  highlight,
  defaultOpen = false,
}: PriorityCriteriaCardProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className="surface-card border-dashed">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Info className="h-4 w-4 text-muted-foreground" />
          Critérios de prioridade
        </CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? (
            <>
              Ocultar <ChevronUp className="ml-1 h-4 w-4" />
            </>
          ) : (
            <>
              Exibir <ChevronDown className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 pt-0">
          {PRIORITY_CRITERIA.map((item) => (
            <div
              key={item.priority}
              className={cn(
                'rounded-lg border p-3 text-sm',
                highlight === item.priority && 'border-primary/40 bg-primary/5',
              )}
            >
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-muted-foreground">{item.description}</p>
              <p className="mt-2 text-xs font-medium text-foreground/80">{item.sla}</p>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}
