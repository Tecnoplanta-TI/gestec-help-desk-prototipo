import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface InfoRowProps {
  label: string
  value: ReactNode
  className?: string
}

/** Linha rótulo/valor para telas de detalhe (responsiva). */
export function InfoRow({ label, value, className }: InfoRowProps): JSX.Element {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-1 border-b py-2.5 last:border-0 md:grid-cols-[200px_1fr] md:items-baseline',
        className,
      )}
    >
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  )
}
