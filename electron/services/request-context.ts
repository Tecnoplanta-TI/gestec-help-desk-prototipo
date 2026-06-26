import { AsyncLocalStorage } from 'async_hooks'

const authTokenStorage = new AsyncLocalStorage<string | undefined>()

/** Executa handler com token JWT da requisição HTTP (modo navegador). */
export async function runWithAuthToken<T>(
  token: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  return authTokenStorage.run(token, fn)
}

export function getRequestAuthToken(): string | undefined {
  return authTokenStorage.getStore()
}
