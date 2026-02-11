import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Plus, Trash2, UserPlus, UserMinus, FolderOpen, Globe, X, ChevronDown, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import { adminApi, type AdminGroup, type AdminUser } from '../../lib/api'
import { useTranslation } from '../../hooks/useTranslation'

export function AdminGroups() {
  const [groups, setGroups] = useState<AdminGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<AdminGroup | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [addMemberEmail, setAddMemberEmail] = useState('')
  const [addMemberRole, setAddMemberRole] = useState('member')
  const [allUsers, setAllUsers] = useState<AdminUser[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { t } = useTranslation()

  const loadGroups = useCallback(() => {
    setIsLoading(true)
    adminApi
      .getGroups()
      .then(setGroups)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    loadGroups()
    adminApi.getUsers().then(setAllUsers).catch(() => {})
  }, [loadGroups])

  // Filter users for autocomplete: match email/name, exclude existing members
  const filteredUsers = useMemo(() => {
    const query = addMemberEmail.trim().toLowerCase()
    if (!query) return []
    const memberEmails = new Set(
      (expandedGroup?.members || []).map(m => m.user.email.toLowerCase())
    )
    return allUsers
      .filter(u =>
        !memberEmails.has(u.email.toLowerCase()) &&
        (u.email.toLowerCase().includes(query) || (u.name || '').toLowerCase().includes(query))
      )
      .slice(0, 8)
  }, [addMemberEmail, allUsers, expandedGroup?.members])

  const loadGroupDetails = useCallback((groupId: string) => {
    adminApi
      .getGroup(groupId)
      .then(setExpandedGroup)
      .catch(() => {})
  }, [])

  const toggleExpand = (groupId: string) => {
    if (expandedGroupId === groupId) {
      setExpandedGroupId(null)
      setExpandedGroup(null)
    } else {
      setExpandedGroupId(groupId)
      loadGroupDetails(groupId)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGroupName.trim()) return
    await adminApi.createGroup({ name: newGroupName, description: newGroupDesc })
    setNewGroupName('')
    setNewGroupDesc('')
    setShowCreateForm(false)
    loadGroups()
  }

  const handleDelete = async (group: AdminGroup) => {
    if (!window.confirm(t('admin.groups.confirmDelete').replace('{name}', group.name))) return
    await adminApi.deleteGroup(group.id)
    if (expandedGroupId === group.id) {
      setExpandedGroupId(null)
      setExpandedGroup(null)
    }
    loadGroups()
  }

  const handleAddMember = async (groupId: string) => {
    if (!addMemberEmail.trim()) return
    try {
      await adminApi.addGroupMember(groupId, { email: addMemberEmail, role: addMemberRole })
      setAddMemberEmail('')
      setAddMemberRole('member')
      loadGroupDetails(groupId)
      loadGroups()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to add member')
    }
  }

  const handleRemoveMember = async (groupId: string, memberId: string) => {
    await adminApi.removeGroupMember(groupId, memberId)
    loadGroupDetails(groupId)
    loadGroups()
  }

  const handleRemoveFolder = async (groupId: string, folderId: string, folderName: string) => {
    if (!window.confirm(t('admin.groups.confirmRemoveCollection').replace('{name}', folderName))) return
    await adminApi.removeGroupFolder(groupId, folderId)
    loadGroupDetails(groupId)
    loadGroups()
  }

  const handleRemoveEnvironment = async (groupId: string, environmentId: string, envName: string) => {
    if (!window.confirm(t('admin.groups.confirmRemoveEnvironment').replace('{name}', envName))) return
    await adminApi.removeGroupEnvironment(groupId, environmentId)
    loadGroupDetails(groupId)
    loadGroups()
  }

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
  }

  return (
    <div className="p-4 space-y-3">
      {/* Create Group button */}
      {!showCreateForm ? (
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
        >
          <Plus className="w-4 h-4" />
          {t('admin.groups.create')}
        </button>
      ) : (
        <form onSubmit={handleCreate} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder={t('admin.groups.groupName')}
            className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <input
            type="text"
            value={newGroupDesc}
            onChange={(e) => setNewGroupDesc(e.target.value)}
            placeholder={t('admin.groups.groupDescription')}
            className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              {t('admin.groups.create')}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-3 py-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {/* Groups list */}
      {groups.length === 0 ? (
        <div className="text-center text-gray-500 py-8 text-sm">{t('admin.groups.noGroups')}</div>
      ) : (
        <div className="space-y-1">
          {groups.map((group) => (
            <div key={group.id} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Group header */}
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                onClick={() => toggleExpand(group.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {expandedGroupId === group.id ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{group.name}</div>
                    {group.description && (
                      <div className="text-xs text-gray-500 truncate">{group.description}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-500">
                    {group._count.members} {t('admin.groups.members').toLowerCase()}
                  </span>
                  <span className="text-xs text-gray-500">
                    {group._count.folders} {t('admin.groups.folders').toLowerCase()}
                  </span>
                  <span className="text-xs text-gray-500">
                    {group._count.environments} {t('admin.groups.environments').toLowerCase()}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(group)
                    }}
                    className="p-1 text-gray-500 hover:text-red-400"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded: members */}
              {expandedGroupId === group.id && expandedGroup && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-2">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('admin.groups.members')}
                  </div>

                  {expandedGroup.members?.map((member) => (
                    <div key={member.id} className="flex items-center justify-between py-1 group/member">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="text-sm text-gray-700 dark:text-gray-300 truncate">{member.user.name}</div>
                        <span className="text-xs text-gray-500">{member.user.email}</span>
                        <span
                          className={clsx(
                            'text-xs px-1.5 py-0.5 rounded',
                            member.role === 'owner'
                              ? 'bg-yellow-900/30 text-yellow-400'
                              : member.role === 'admin'
                                ? 'bg-blue-900/30 text-blue-400'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          )}
                        >
                          {member.role}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(group.id, member.id)}
                        className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover/member:opacity-100"
                        title={t('admin.groups.removeMember')}
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Add member form */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                    <UserPlus className="w-4 h-4 text-gray-500 shrink-0" />
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={addMemberEmail}
                        onChange={(e) => {
                          setAddMemberEmail(e.target.value)
                          setShowSuggestions(true)
                          setHighlightIndex(-1)
                        }}
                        onFocus={() => { if (addMemberEmail.trim()) setShowSuggestions(true) }}
                        onBlur={() => {
                          blurTimeoutRef.current = setTimeout(() => setShowSuggestions(false), 150)
                        }}
                        placeholder={t('admin.groups.memberEmail')}
                        className="w-full px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs focus:outline-none focus:border-blue-500"
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            setHighlightIndex(i => Math.min(i + 1, filteredUsers.length - 1))
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            setHighlightIndex(i => Math.max(i - 1, -1))
                          } else if (e.key === 'Enter') {
                            e.preventDefault()
                            if (highlightIndex >= 0 && highlightIndex < filteredUsers.length) {
                              setAddMemberEmail(filteredUsers[highlightIndex].email)
                              setShowSuggestions(false)
                              setHighlightIndex(-1)
                            } else {
                              handleAddMember(group.id)
                            }
                          } else if (e.key === 'Escape') {
                            setShowSuggestions(false)
                          }
                        }}
                      />
                      {showSuggestions && filteredUsers.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg max-h-48 overflow-y-auto">
                          {filteredUsers.map((user, i) => (
                            <button
                              key={user.id}
                              type="button"
                              onMouseDown={() => {
                                if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
                                setAddMemberEmail(user.email)
                                setShowSuggestions(false)
                                setHighlightIndex(-1)
                              }}
                              className={clsx(
                                'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left',
                                i === highlightIndex
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                              )}
                            >
                              <span className="text-gray-800 dark:text-gray-200 truncate">{user.name || '—'}</span>
                              <span className="text-gray-400 truncate">{user.email}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <select
                      value={addMemberRole}
                      onChange={(e) => setAddMemberRole(e.target.value)}
                      className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                      <option value="owner">owner</option>
                    </select>
                    <button
                      onClick={() => handleAddMember(group.id)}
                      className="px-2 py-1 text-xs text-blue-400 hover:bg-blue-900/30 rounded"
                    >
                      {t('admin.groups.addMember')}
                    </button>
                  </div>

                  {/* Collections */}
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      {t('admin.groups.folders')}
                    </div>

                    {expandedGroup.folders && expandedGroup.folders.length > 0 ? (
                      expandedGroup.folders.map((folder) => (
                        <div key={folder.id} className="flex items-center justify-between py-1 group/folder">
                          <div className="flex items-center gap-2 min-w-0">
                            <FolderOpen className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{folder.name}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveFolder(group.id, folder.id, folder.name)}
                            className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover/folder:opacity-100"
                            title={t('admin.groups.removeCollection')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500 italic">{t('admin.groups.noCollections')}</div>
                    )}
                  </div>

                  {/* Environments */}
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      {t('admin.groups.environments')}
                    </div>

                    {expandedGroup.environments && expandedGroup.environments.length > 0 ? (
                      expandedGroup.environments.map((env) => (
                        <div key={env.id} className="flex items-center justify-between py-1 group/env">
                          <div className="flex items-center gap-2 min-w-0">
                            <Globe className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{env.name}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveEnvironment(group.id, env.id, env.name)}
                            className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover/env:opacity-100"
                            title={t('admin.groups.removeEnvironment')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500 italic">{t('admin.groups.noEnvironments')}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
