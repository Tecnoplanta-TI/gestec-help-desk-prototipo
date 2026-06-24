/**
 * electron/ipc/auth-ipc.ts — IPC handlers de autenticação e gestão de usuários
 *
 * Registra todos os handlers IPC relacionados a auth no ipcMain.
 * Chamar registerAuthHandlers() em electron/main.ts durante app.whenReady().
 *
 * Segurança:
 * - Todos os inputs validados com Zod antes de qualquer operação
 * - passwordHash nunca retorna ao Renderer
 * - Token JWT armazenado apenas no Main Process (electron-store)
 */

import { is } from '@electron-toolkit/utils'
import { ipcMain } from 'electron'
import { z } from 'zod'
import type { User } from '../../shared/types'
import {
  hashPassword,
  verifyPassword,
  signToken,
  saveSession,
  clearSession,
  getStoredSession,
} from '../services/auth'
import {
  findUserByEmail,
  listUsers,
  createUser as dbCreateUser,
  updateUser as dbUpdateUser,
  updatePasswordHash,
  toggleUserActive as dbToggleUserActive,
} from '../services/user'
import {
  buildOfflineAdminUser,
  ensureOfflineAdminSession,
  isOfflineAdminCredential,
  resolveAuthenticatedUser,
} from '../services/session-user'
import type { LoginResult } from '../../shared/types'

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

const LoginSchema = z.object({
  email: z.string().min(1).max(254),
  password: z.string().min(1),
})

const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(['member', 'manager', 'admin']),
  password: z.string().min(8).max(128),
})

const UpdateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['member', 'manager', 'admin']).optional(),
})

const ResetPasswordSchema = z.object({
  userId: z.string().uuid(),
  newPassword: z.string().min(8).max(128),
})

const ToggleActiveSchema = z.object({
  userId: z.string().uuid(),
  active: z.boolean(),
})

// ─── Helper: erro tipado ──────────────────────────────────────────────────────

function ipcError(code: string, message?: string): never {
  throw Object.assign(new Error(message ?? code), { code })
}

// ─── Rate limiting (login) ───────────────────────────────────────────────────

const LOGIN_LIMIT_MAX_ATTEMPTS = 5
const LOGIN_LIMIT_WINDOW_MS = 60_000
const loginAttempts = new Map<string, { count: number; windowStart: number }>()

function assertLoginRateLimit(email: string): void {
  const key = email.toLowerCase()
  const now = Date.now()
  const existing = loginAttempts.get(key)
  if (!existing) return

  if (now - existing.windowStart > LOGIN_LIMIT_WINDOW_MS) {
    loginAttempts.delete(key)
    return
  }

  if (existing.count >= LOGIN_LIMIT_MAX_ATTEMPTS) {
    ipcError('RATE_LIMIT_EXCEEDED')
  }
}

function registerLoginFailure(email: string): void {
  const key = email.toLowerCase()
  const now = Date.now()
  const existing = loginAttempts.get(key)
  if (!existing || now - existing.windowStart > LOGIN_LIMIT_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, windowStart: now })
    return
  }
  loginAttempts.set(key, { count: existing.count + 1, windowStart: existing.windowStart })
}

function clearLoginAttempts(email: string): void {
  loginAttempts.delete(email.toLowerCase())
}

function isCosmosUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Connection string não configurada')
}

// ─── Helpers de autorização ──────────────────────────────────────────────────

async function requireAuthenticatedUser(): Promise<User> {
  const user = await resolveAuthenticatedUser()
  if (!user) ipcError('UNAUTHORIZED')
  return user
}

async function requireAdmin(): Promise<User> {
  const user = await requireAuthenticatedUser()
  if (user.role !== 'admin') ipcError('FORBIDDEN')
  return user
}

// ─── Registro dos handlers ────────────────────────────────────────────────────

export function registerAuthHandlers(): void {

  // ── auth:login ──────────────────────────────────────────────────────────────
  ipcMain.handle('auth:login', async (_event, email: string, password: string) => {
    const parsed = LoginSchema.safeParse({ email, password })
    if (!parsed.success) ipcError('INVALID_INPUT')

    const normalizedEmail = parsed.data.email.trim().toLowerCase()
    assertLoginRateLimit(normalizedEmail)

    let userDoc = null
    try {
      userDoc = await findUserByEmail(normalizedEmail)
    } catch (error) {
      if (isCosmosUnavailableError(error) && isOfflineAdminCredential(normalizedEmail, parsed.data.password)) {
        const offlineAdmin = buildOfflineAdminUser()
        const { token, expiresAt } = await signToken(offlineAdmin)
        saveSession(token, offlineAdmin.id, expiresAt)
        clearLoginAttempts(normalizedEmail)
        return { user: offlineAdmin, expiresAt } satisfies LoginResult
      }
      throw error
    }

    if (!userDoc) {
      if (isOfflineAdminCredential(normalizedEmail, parsed.data.password)) {
        const offlineAdmin = buildOfflineAdminUser()
        const { token, expiresAt } = await signToken(offlineAdmin)
        saveSession(token, offlineAdmin.id, expiresAt)
        clearLoginAttempts(normalizedEmail)
        return { user: offlineAdmin, expiresAt } satisfies LoginResult
      }
      registerLoginFailure(normalizedEmail)
      ipcError('INVALID_CREDENTIALS')
    }

    if (!userDoc.active) {
      registerLoginFailure(normalizedEmail)
      ipcError('ACCOUNT_DISABLED')
    }

    const valid = await verifyPassword(parsed.data.password, userDoc.passwordHash)
    if (!valid) {
      registerLoginFailure(normalizedEmail)
      ipcError('INVALID_CREDENTIALS')
    }

    const { token, expiresAt } = await signToken(userDoc)
    saveSession(token, userDoc.id, expiresAt)
    clearLoginAttempts(normalizedEmail)

    // Nunca retornar passwordHash
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _h, ...user } = userDoc
    return { user, expiresAt } satisfies LoginResult
  })

  // ── auth:logout ─────────────────────────────────────────────────────────────
  ipcMain.handle('auth:logout', async () => {
    clearSession()
  })

  // ── auth:get-session ────────────────────────────────────────────────────────
  ipcMain.handle('auth:get-session', async (): Promise<LoginResult | null> => {
    if (is.dev) {
      await ensureOfflineAdminSession()
    }

    const session = getStoredSession()
    if (!session) return null

    const user = await resolveAuthenticatedUser()
    if (!user) return null

    return { user, expiresAt: session.expiresAt }
  })

  // ── auth:list-users ─────────────────────────────────────────────────────────
  ipcMain.handle('auth:list-users', async () => {
    await requireAdmin()
    return listUsers()
  })

  // ── auth:create-user ────────────────────────────────────────────────────────
  ipcMain.handle('auth:create-user', async (_event, payload: unknown) => {
    await requireAdmin()
    const parsed = CreateUserSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    const existing = await findUserByEmail(parsed.data.email)
    if (existing) ipcError('EMAIL_ALREADY_EXISTS')

    const passwordHash = await hashPassword(parsed.data.password)
    return dbCreateUser({ ...parsed.data, passwordHash })
  })

  // ── auth:update-user ────────────────────────────────────────────────────────
  ipcMain.handle('auth:update-user', async (_event, payload: unknown) => {
    await requireAdmin()
    const parsed = UpdateUserSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    if (parsed.data.email) {
      const existing = await findUserByEmail(parsed.data.email)
      if (existing && existing.id !== parsed.data.id) ipcError('EMAIL_ALREADY_EXISTS')
    }

    const { id, ...data } = parsed.data
    return dbUpdateUser(id, data)
  })

  // ── auth:reset-password ─────────────────────────────────────────────────────
  ipcMain.handle('auth:reset-password', async (_event, payload: unknown) => {
    await requireAdmin()
    const parsed = ResetPasswordSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    const passwordHash = await hashPassword(parsed.data.newPassword)
    await updatePasswordHash(parsed.data.userId, passwordHash)
  })

  // ── auth:toggle-user-active ─────────────────────────────────────────────────
  ipcMain.handle('auth:toggle-user-active', async (_event, payload: unknown) => {
    const currentUser = await requireAdmin()
    const parsed = ToggleActiveSchema.safeParse(payload)
    if (!parsed.success) ipcError('INVALID_INPUT')

    if (currentUser.id === parsed.data.userId && parsed.data.active === false) {
      ipcError('SELF_DEACTIVATE_FORBIDDEN')
    }

    return dbToggleUserActive(parsed.data.userId, parsed.data.active)
  })
}
