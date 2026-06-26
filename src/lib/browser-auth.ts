const AUTH_TOKEN_KEY = 'gestec.auth.token'

export function getBrowserAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setBrowserAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearBrowserAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

async function invokeRpc<T>(channel: string, args: unknown[] = []): Promise<T> {
  const token = getBrowserAuthToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch('/api/rpc', {
    method: 'POST',
    headers,
    body: JSON.stringify({ channel, args }),
  })

  const body = (await response.json()) as { result?: T; code?: string; message?: string }
  if (!response.ok) {
    if (response.status === 401) {
      clearBrowserAuthToken()
    }
    throw Object.assign(new Error(body.message ?? body.code ?? 'RPC_ERROR'), { code: body.code })
  }

  return body.result as T
}

function rpc<T>(channel: string, ...args: unknown[]): Promise<T> {
  return invokeRpc<T>(channel, args)
}

export { rpc }
