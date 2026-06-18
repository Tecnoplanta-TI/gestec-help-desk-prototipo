/**
 * electron/services/auth.ts — Lógica de autenticação
 *
 * Responsabilidades:
 * - Geração e verificação de hash bcryptjs
 * - Assinatura e verificação de JWT via jose
 * - Geração e persistência do JWT secret no electron-store
 * - Armazenamento seguro do token da sessão ativa
 */

import { randomBytes } from 'crypto'
import * as bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import Store from 'electron-store'
import type { User, LoginResult } from '../../shared/types'

// ─── electron-store schema ────────────────────────────────────────────────────

interface AuthStoreSchema {
  jwtSecret?: string
  session?: {
    token: string
    userId: string
    expiresAt: string
  } | null
}

const store = new Store<AuthStoreSchema>({
  name: 'auth',
  encryptionKey: 'gestec-auth-store-key', // chave de ofuscação (não substitui TLS)
})

// ─── JWT Secret ───────────────────────────────────────────────────────────────

/** Retorna o JWT secret, gerando e persistindo um novo se não existir */
function getJwtSecret(): Uint8Array {
  let secret = store.get('jwtSecret')
  if (!secret) {
    secret = randomBytes(32).toString('hex')
    store.set('jwtSecret', secret)
  }
  return new TextEncoder().encode(secret)
}

// ─── Hash bcryptjs ────────────────────────────────────────────────────────────

const BCRYPT_COST = 12

/** Gera hash bcryptjs de uma senha */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

/** Compara senha em texto claro com hash armazenado */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

const JWT_EXPIRY_HOURS = 8

/** Assina um JWT para o usuário informado */
export async function signToken(user: User): Promise<{ token: string; expiresAt: string }> {
  const secret = getJwtSecret()
  const expiresAt = new Date(Date.now() + JWT_EXPIRY_HOURS * 60 * 60 * 1000)

  const token = await new SignJWT({ sub: user.id, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret)

  return { token, expiresAt: expiresAt.toISOString() }
}

/** Verifica e decodifica um JWT. Retorna null se inválido ou expirado */
export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret)
    return { userId: payload.sub as string }
  } catch {
    return null
  }
}

// ─── Sessão persistida ────────────────────────────────────────────────────────

/** Persiste a sessão ativa no electron-store */
export function saveSession(token: string, userId: string, expiresAt: string): void {
  store.set('session', { token, userId, expiresAt })
}

/** Remove a sessão do electron-store */
export function clearSession(): void {
  store.set('session', null)
}

/** Retorna a sessão salva, ou null se não houver / estiver expirada */
export function getStoredSession(): { token: string; userId: string; expiresAt: string } | null {
  const session = store.get('session')
  if (!session) return null

  // Verifica expiração local (sem chave criptográfica — apenas como filtro rápido)
  if (new Date(session.expiresAt) <= new Date()) {
    clearSession()
    return null
  }

  return session
}

// ─── Utilitário para resultado de login ──────────────────────────────────────

/** Monta o objeto LoginResult a partir do usuário e do token assinado */
export function buildLoginResult(user: User, token: string, expiresAt: string): LoginResult {
  return { user, expiresAt }
}
