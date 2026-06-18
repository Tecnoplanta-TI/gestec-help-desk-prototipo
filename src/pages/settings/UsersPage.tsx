import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Plus, ShieldAlert, UserCog, Users } from 'lucide-react'
import type { User, UserRole } from '../../../shared/types'
import { ipc } from '@/lib/ipc'
import { getIpcErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusAlert } from '@/components/shared/StatusAlert'
import { EmptyState } from '@/components/shared/EmptyState'
import { InlineLoader } from '@/components/shared/PageLoader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type EditableUser = Pick<User, 'id' | 'name' | 'email' | 'role' | 'active'>

const ROLES: UserRole[] = ['member', 'manager', 'admin']
const ROLE_LABEL: Record<UserRole, string> = {
  member: 'Membro',
  manager: 'Gestor',
  admin: 'Administrador',
}

function formatError(error: unknown): string {
  return getIpcErrorMessage(error, { fallback: 'Não foi possível concluir a operação.' })
}

export default function UsersPage(): JSX.Element {
  const currentUser = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<EditableUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('member')
  const [newPassword, setNewPassword] = useState('')

  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('member')
  const [resetPassword, setResetPassword] = useState('')

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId],
  )

  async function loadUsers(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const result = await ipc.listUsers()
      setUsers(result)
      if (!selectedUserId && result.length > 0) setSelectedUserId(result[0].id)
      if (selectedUserId && !result.some((user) => user.id === selectedUserId)) {
        setSelectedUserId(result[0]?.id ?? null)
      }
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  useEffect(() => {
    if (!selectedUser) return
    setEditName(selectedUser.name)
    setEditEmail(selectedUser.email)
    setEditRole(selectedUser.role)
    setResetPassword('')
  }, [selectedUser])

  async function handleCreateUser(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setFeedback(null)
    try {
      const created = await ipc.createUser({
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        password: newPassword,
      })
      setFeedback(`Usuário ${created.name} criado com sucesso.`)
      setNewName('')
      setNewEmail('')
      setNewRole('member')
      setNewPassword('')
      setShowCreate(false)
      await loadUsers()
      setSelectedUserId(created.id)
    } catch (err) {
      setError(formatError(err))
    }
  }

  async function handleUpdateUser(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!selectedUser) return
    setError(null)
    setFeedback(null)
    try {
      await ipc.updateUser({
        id: selectedUser.id,
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        role: editRole,
      })
      setFeedback('Usuário atualizado com sucesso.')
      await loadUsers()
    } catch (err) {
      setError(formatError(err))
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!selectedUser) return
    setError(null)
    setFeedback(null)
    try {
      await ipc.resetPassword({ userId: selectedUser.id, newPassword: resetPassword })
      setFeedback('Senha redefinida com sucesso.')
      setResetPassword('')
    } catch (err) {
      setError(formatError(err))
    }
  }

  async function handleToggleActive(user: EditableUser): Promise<void> {
    setError(null)
    setFeedback(null)
    try {
      const updated = await ipc.toggleUserActive({ userId: user.id, active: !user.active })
      setFeedback(
        updated.active
          ? `Conta de ${updated.name} reativada com sucesso.`
          : `Conta de ${updated.name} desativada com sucesso.`,
      )
      await loadUsers()
    } catch (err) {
      setError(formatError(err))
    }
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="space-y-6">
        <PageHeader title="Usuários" description="Criação e gestão de contas internas." />
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito"
          description="Apenas administradores podem gerenciar contas de usuário."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Usuários" description="Criação e gestão de contas internas.">
        <Button onClick={() => setShowCreate((prev) => !prev)} className="gap-2">
          <Plus className="h-4 w-4" />
          {showCreate ? 'Fechar formulário' : 'Novo usuário'}
        </Button>
      </PageHeader>

      {error ? <StatusAlert variant="error" message={error} /> : null}
      {feedback ? <StatusAlert variant="success" message={feedback} /> : null}

      {showCreate ? (
        <Card className="surface-card animate-in fade-in slide-in-from-top-1 duration-300">
          <CardHeader>
            <CardTitle className="text-lg">Criar novo usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateUser}>
              <div className="space-y-2">
                <Label htmlFor="new-name">Nome completo</Label>
                <Input
                  id="new-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome do usuário"
                  minLength={2}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email">E-mail</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@empresa.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Senha inicial</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  required
                />
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit">Criar usuário</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-muted-foreground" />
              Contas cadastradas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4">
                <InlineLoader rows={4} />
              </div>
            ) : users.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={Users} title="Nenhum usuário" description="Crie a primeira conta." />
              </div>
            ) : (
              <ul className="max-h-[520px] divide-y overflow-y-auto">
                {users.map((user) => (
                  <li key={user.id}>
                    <button
                      onClick={() => setSelectedUserId(user.id)}
                      className={cn(
                        'w-full px-4 py-3 text-left transition-colors',
                        selectedUserId === user.id ? 'bg-accent' : 'hover:bg-muted/50',
                      )}
                    >
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge variant="outline">{ROLE_LABEL[user.role]}</Badge>
                        <Badge variant={user.active ? 'default' : 'destructive'}>
                          {user.active ? 'Ativo' : 'Desativado'}
                        </Badge>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCog className="h-4 w-4 text-muted-foreground" />
                Editar usuário
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedUser ? (
                <p className="text-sm text-muted-foreground">Selecione um usuário para editar.</p>
              ) : (
                <form className="grid gap-4 md:grid-cols-3" onSubmit={handleUpdateUser}>
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Nome</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      minLength={2}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">E-mail</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Perfil</Label>
                    <Select value={editRole} onValueChange={(value) => setEditRole(value as UserRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABEL[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <Button type="submit" variant="secondary">
                      Salvar alterações
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="text-base">Segurança da conta</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedUser ? (
                <p className="text-sm text-muted-foreground">
                  Selecione um usuário para gerenciar a segurança.
                </p>
              ) : (
                <div className="space-y-4">
                  <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleResetPassword}>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="reset-password">Nova senha</Label>
                      <Input
                        id="reset-password"
                        type="password"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        minLength={8}
                        required
                      />
                    </div>
                    <Button type="submit" variant="outline">
                      Redefinir senha
                    </Button>
                  </form>

                  <Button
                    variant={selectedUser.active ? 'destructive' : 'default'}
                    onClick={() => void handleToggleActive(selectedUser)}
                    disabled={selectedUser.id === currentUser.id && selectedUser.active}
                  >
                    {selectedUser.active ? 'Desativar conta' : 'Reativar conta'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
