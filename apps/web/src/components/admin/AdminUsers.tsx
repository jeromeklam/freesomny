import { useEffect, useState, useCallback } from 'react'
import { Search, RotateCcw, Trash2, ShieldCheck, ShieldOff, UserCheck, UserX, Clock, MailCheck } from 'lucide-react'
import { clsx } from 'clsx'
import { adminApi, type AdminUser } from '../../lib/api'
import { useTranslation } from '../../hooks/useTranslation'

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const { t } = useTranslation()

  const loadUsers = useCallback(() => {
    setIsLoading(true)
    adminApi
      .getUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleToggleActive = async (user: AdminUser) => {
    const msg = user.isActive
      ? t('admin.users.confirmDeactivate').replace('{name}', user.name)
      : undefined

    if (msg && !window.confirm(msg)) return

    await adminApi.updateUser(user.id, { isActive: !user.isActive })
    loadUsers()
  }

  const handleChangeRole = async (user: AdminUser, role: string) => {
    await adminApi.updateUser(user.id, { role })
    loadUsers()
  }

  const handleResetPassword = async (user: AdminUser) => {
    const result = await adminApi.resetUserPassword(user.id)
    if (result.consoleOnly) {
      window.alert(t('admin.users.passwordResetConsole'))
    } else {
      window.alert(t('admin.users.passwordResetSent'))
    }
  }

  const handleApprove = async (user: AdminUser) => {
    await adminApi.approveUser(user.id)
    loadUsers()
  }

  const handleReject = async (user: AdminUser) => {
    if (!window.confirm(t('admin.users.confirmReject').replace('{name}', user.name))) return
    await adminApi.rejectUser(user.id)
    loadUsers()
  }

  const handleDelete = async (user: AdminUser) => {
    if (!window.confirm(t('admin.users.confirmDelete').replace('{name}', user.name))) return
    await adminApi.deleteUser(user.id)
    loadUsers()
  }

  // Separate pending users (verified but not active)
  const pendingUsers = users.filter((u) => u.isVerified && !u.isActive)

  const filtered = search
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users

  if (isLoading) {
    return <div className="p-6 text-center text-gray-400">{t('common.loading')}</div>
  }

  return (
    <div className="p-4 space-y-3">
      {/* Pending Approvals */}
      {pendingUsers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-orange-400 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('admin.users.pendingApprovals')} ({pendingUsers.length})
          </h3>
          <div className="space-y-1">
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 bg-orange-900/20 border border-orange-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span title={t('admin.users.verified')}>
                    <MailCheck className="w-4 h-4 text-green-400 shrink-0" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate">{user.name}</div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(user)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-green-400 hover:bg-green-900/30 rounded"
                    title={t('admin.users.approve')}
                  >
                    <UserCheck className="w-4 h-4" />
                    {t('admin.users.approve')}
                  </button>
                  <button
                    onClick={() => handleReject(user)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:bg-red-900/30 rounded"
                    title={t('admin.users.reject')}
                  >
                    <UserX className="w-4 h-4" />
                    {t('admin.users.reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.users.search')}
          className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* User list */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-8 text-sm">{t('admin.users.noUsers')}</div>
      ) : (
        <div className="space-y-1">
          {filtered.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 bg-gray-900 border border-gray-700 rounded-lg group hover:border-gray-600"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={clsx(
                    'w-2 h-2 rounded-full shrink-0',
                    user.isActive ? 'bg-green-400' : !user.isVerified ? 'bg-yellow-400' : 'bg-red-400'
                  )}
                  title={
                    user.isActive
                      ? t('admin.users.active')
                      : !user.isVerified
                        ? t('admin.users.pendingVerification')
                        : t('admin.users.pendingApproval')
                  }
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-200 truncate">{user.name}</div>
                  <div className="text-xs text-gray-500 truncate">{user.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Role selector */}
                <select
                  value={user.role}
                  onChange={(e) => handleChangeRole(user, e.target.value)}
                  className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs focus:outline-none focus:border-blue-500"
                  title={t('admin.users.changeRole')}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>

                {/* Collections / Groups count */}
                <span className="text-xs text-gray-500 w-16 text-center" title={t('admin.users.collections')}>
                  {user._count.folders} col
                </span>
                <span className="text-xs text-gray-500 w-16 text-center" title={t('admin.users.groups')}>
                  {user._count.groupMemberships} grp
                </span>

                {/* Toggle active */}
                <button
                  onClick={() => handleToggleActive(user)}
                  className={clsx(
                    'p-1.5 rounded text-xs',
                    user.isActive
                      ? 'text-yellow-400 hover:bg-yellow-900/30'
                      : 'text-green-400 hover:bg-green-900/30'
                  )}
                  title={user.isActive ? t('admin.users.deactivate') : t('admin.users.activate')}
                >
                  {user.isActive ? (
                    <ShieldOff className="w-4 h-4" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                </button>

                {/* Reset password */}
                <button
                  onClick={() => handleResetPassword(user)}
                  className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded"
                  title={t('admin.users.resetPassword')}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(user)}
                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded opacity-0 group-hover:opacity-100"
                  title={t('admin.users.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
