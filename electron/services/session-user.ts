/**
 * electron/services/session-user.ts — Resolução de usuário autenticado
 *
 * Centraliza o usuário offline (dev sem Cosmos) e a validação de sessão
 * usada pelos handlers IPC.
 */

import type { User } from '../../shared/types'
import {
  clearSession,
  getStoredSession,
  saveSession,
  signToken,
  verifyToken,
} from './auth'
import { findUserById } from './user'

export const OFFLINE_ADMIN_ID = '00000000-0000-0000-0000-000000000001'

export function buildOfflineAdminUser(): User {
  const now = new Date().toISOString()
  return {
    id: OFFLINE_ADMIN_ID,
    name: 'Admin Local',
    email: 'admin',
    role: 'admin',
    active: true,
    permissions: ['*'],
    createdAt: now,
    updatedAt: now,
  }
}

export function isOfflineAdminCredential(identifier: string, password: string): boolean {
  return identifier.trim().toLowerCase() === 'admin' && password === 'admin'
}

/** Retorna o usuário da sessão ativa, ou null se não autenticado */
export async function resolveAuthenticatedUser(): Promise<User | null> {
  const session = getStoredSession()
  if (!session) return null

  const verified = await verifyToken(session.token)
  if (!verified) {
    clearSession()
    return null
  }

  if (verified.userId === OFFLINE_ADMIN_ID) {
    return buildOfflineAdminUser()
  }

  const user = await findUserById(verified.userId)
  if (!user || !user.active) {
    clearSession()
    return null
  }

  return user
}

/** Cria sessão do admin offline quando não há sessão (dev sem login) */
export async function ensureOfflineAdminSession(): Promise<void> {
  if (getStoredSession()) return

  const offlineAdmin = buildOfflineAdminUser()
  const { token, expiresAt } = await signToken(offlineAdmin)
  saveSession(token, offlineAdmin.id, expiresAt)
}
