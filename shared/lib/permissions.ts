import type { User } from '../types'

export const PERMISSIONS = [
  'requester',
  'it_manager',
  'app_manager',
  'triage',
  'agent',
  'cancellation_approver',
  'cancellation_direct_approve',
  'admin',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export function hasPermission(user: Pick<User, 'role' | 'permissions'>, permission: Permission): boolean {
  if (user.role === 'admin' || user.permissions.includes('admin')) return true
  if (user.permissions.includes(permission)) return true
  if (permission === 'agent' && user.role === 'member') return true
  if (permission === 'triage' && user.role === 'manager') return true
  if (permission === 'it_manager' && user.role === 'manager') return true
  if (permission === 'app_manager' && user.role === 'manager') return true
  if (permission === 'requester') return true
  return false
}

export function hasAnyPermission(
  user: Pick<User, 'role' | 'permissions'>,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(user, p))
}
