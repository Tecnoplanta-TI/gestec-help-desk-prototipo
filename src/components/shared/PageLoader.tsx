import { Skeleton } from '@/components/ui/skeleton'

/** Loader com skeleton — percepção de carregamento mais fluida que spinner isolado */
export function PageLoader(): JSX.Element {
  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex h-14 items-center justify-between border-b px-4 md:px-6">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 border-r p-4 md:block">
          <Skeleton className="mb-6 h-10 w-full" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </aside>
        <main className="flex-1 space-y-6 p-4 md:p-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </main>
      </div>
    </div>
  )
}

export function InlineLoader({ rows = 3 }: { rows?: number }): JSX.Element {
  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  )
}
