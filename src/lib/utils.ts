/**
 * src/lib/utils.ts
 *
 * Utilitários gerais do Renderer — funções puras e agnósticas de domínio.
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combina classes CSS condicionalmente e resolve conflitos Tailwind.
 * Padrão shadcn/ui — use em todos os componentes.
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-primary', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
