/**
 * electron/services/user.ts — CRUD de usuários no Cosmos DB
 *
 * Todas as operações de leitura/escrita de usuários ficam aqui.
 * Nunca expor passwordHash para fora deste serviço.
 */

import { randomUUID } from 'crypto'
import { getContainer } from './cosmos'
import type { User, UserRole } from '../../shared/types'

// Documento completo do usuário (inclui passwordHash — apenas no Main Process)
export interface UserDocument extends User {
  passwordHash: string
}

const CONTAINER = 'users'

/** Remove o passwordHash antes de retornar ao Renderer */
function toPublicUser(doc: UserDocument): User {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _h, ...user } = doc
  return user
}

/** Lista todos os usuários (sem passwordHash) */
export async function listUsers(): Promise<User[]> {
  const container = await getContainer(CONTAINER)
  const { resources } = await container.items
    .query<UserDocument>('SELECT * FROM c ORDER BY c.name')
    .fetchAll()
  return resources.map(toPublicUser)
}

/** Busca usuário por e-mail (com passwordHash — uso interno apenas) */
export async function findUserByEmail(email: string): Promise<UserDocument | null> {
  const container = await getContainer(CONTAINER)
  const { resources } = await container.items
    .query<UserDocument>({
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: email.toLowerCase() }],
    })
    .fetchAll()
  return resources[0] ?? null
}

/** Busca usuário por ID (sem passwordHash) */
export async function findUserById(id: string): Promise<User | null> {
  const container = await getContainer(CONTAINER)
  try {
    const { resource } = await container.item(id, id).read<UserDocument>()
    return resource ? toPublicUser(resource) : null
  } catch {
    return null
  }
}

/** Cria um novo usuário */
export async function createUser(data: {
  name: string
  email: string
  role: UserRole
  passwordHash: string
}): Promise<User> {
  const container = await getContainer(CONTAINER)
  const now = new Date().toISOString()
  const doc: UserDocument = {
    id: randomUUID(),
    name: data.name,
    email: data.email.toLowerCase(),
    role: data.role,
    active: true,
    permissions: [],
    passwordHash: data.passwordHash,
    createdAt: now,
    updatedAt: now,
  }
  const { resource } = await container.items.create<UserDocument>(doc)
  return toPublicUser(resource!)
}

/** Atualiza nome, e-mail ou papel do usuário */
export async function updateUser(
  id: string,
  data: Partial<Pick<User, 'name' | 'email' | 'role'>>,
): Promise<User> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(id, id).read<UserDocument>()
  if (!existing) throw new Error('USER_NOT_FOUND')

  const updated: UserDocument = {
    ...existing,
    ...data,
    email: data.email ? data.email.toLowerCase() : existing.email,
    updatedAt: new Date().toISOString(),
  }
  const { resource } = await container.item(id, id).replace<UserDocument>(updated)
  return toPublicUser(resource!)
}

/** Atualiza o hash da senha do usuário */
export async function updatePasswordHash(id: string, passwordHash: string): Promise<void> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(id, id).read<UserDocument>()
  if (!existing) throw new Error('USER_NOT_FOUND')

  await container.item(id, id).replace<UserDocument>({
    ...existing,
    passwordHash,
    updatedAt: new Date().toISOString(),
  })
}

/** Ativa ou desativa uma conta de usuário */
export async function toggleUserActive(id: string, active: boolean): Promise<User> {
  const container = await getContainer(CONTAINER)
  const { resource: existing } = await container.item(id, id).read<UserDocument>()
  if (!existing) throw new Error('USER_NOT_FOUND')

  const updated: UserDocument = {
    ...existing,
    active,
    updatedAt: new Date().toISOString(),
  }
  const { resource } = await container.item(id, id).replace<UserDocument>(updated)
  return toPublicUser(resource!)
}

/** Verifica se existe pelo menos um admin no banco */
export async function hasAnyAdmin(): Promise<boolean> {
  const container = await getContainer(CONTAINER)
  const { resources } = await container.items
    .query<UserDocument>({
      query: "SELECT TOP 1 c.id FROM c WHERE c.role = 'admin' AND c.active = true",
    })
    .fetchAll()
  return resources.length > 0
}
