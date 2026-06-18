import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

interface StatusAlertProps {
  variant: 'error' | 'success'
  message: string
  className?: string
}

/** Feedback visual consistente para erros e sucessos */
export function StatusAlert({ variant, message, className }: StatusAlertProps): JSX.Element {
  const Icon = variant === 'error' ? AlertCircle : CheckCircle2

  return (
    <Alert
      className={cn(
        'animate-in fade-in slide-in-from-top-1 duration-300',
        variant === 'error'
          ? 'border-destructive/30 bg-destructive/10 text-destructive [&>svg]:text-destructive'
          : 'border-primary/30 bg-primary/10 text-primary [&>svg]:text-primary',
        className,
      )}
    >
      <Icon className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
