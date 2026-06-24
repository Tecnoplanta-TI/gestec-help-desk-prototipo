/**
 * Contexto de autenticação por requisição HTTP (Bearer token).
 */

import { AsyncLocalStorage } from 'node:async_hooks'

const storage = new AsyncLocalStorage<{ token?: string }>()

export function runWithAuthToken<T>(token: string | undefined, fn: () => T): T {
  return storage.run({ token }, fn)
}

export function getRequestAuthToken(): string | undefined {
  return storage.getStore()?.token
}
