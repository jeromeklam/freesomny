import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Plus, Trash2, RotateCcw, Lock, Unlock, GripVertical, Tag, Cog, Users, Shield } from 'lucide-react'
import { ResizableModal } from './ResizableModal'
import { clsx } from 'clsx'
import { useAppStore } from '../stores/app'
import { useEnvironmentVariables, useDeleteEnvironment, useGroups, useAssignEnvironmentToGroup, useUnassignEnvironmentFromGroup } from '../hooks/useApi'
import { useTranslation } from '../hooks/useTranslation'
import { environmentsApi } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'

interface VariableView {
  key: string
  teamValue: string
  localValue: string | null
  description: string
  type: string
  isSecret: boolean
  isProtected: boolean
  category: 'input' | 'generated'
  sortOrder: number
  status: 'team' | 'overridden'
}

export function EnvironmentModal() {
  const [activeTab, setActiveTab] = useState<'variables' | 'settings'>('variables')
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newIsSecret, setNewIsSecret] = useState(false)
  const [newCategory, setNewCategory] = useState<'input' | 'generated'>('input')
  const [showSecrets, setShowSecrets] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [settingsChanged, setSettingsChanged] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  // Local buffer for override inputs — saves on blur, not on every keystroke
  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>({})

  const showEnvironmentModal = useAppStore((s) => s.showEnvironmentModal)
  const setShowEnvironmentModal = useAppStore((s) => s.setShowEnvironmentModal)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const environments = useAppStore((s) => s.environments)
  const setEnvironments = useAppStore((s) => s.setEnvironments)

  const { data: variablesData, refetch } = useEnvironmentVariables(activeEnvironmentId)
  const deleteEnvironment = useDeleteEnvironment()
  const { data: groupsData } = useGroups()
  const assignToGroup = useAssignEnvironmentToGroup()
  const unassignFromGroup = useUnassignEnvironmentFromGroup()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const dragRowRef = useRef<HTMLTableRowElement | null>(null)

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId)

  // Parse response: new format { variables, canEditProtected } or legacy array
  const rawData = variablesData as unknown
  let variablesList: VariableView[] = []
  let canEditProtected = false
  if (rawData && typeof rawData === 'object' && 'variables' in (rawData as Record<string, unknown>)) {
    const shaped = rawData as { variables: VariableView[]; canEditProtected: boolean }
    variablesList = shaped.variables || []
    canEditProtected = shaped.canEditProtected || false
  } else {
    variablesList = ((rawData || []) as VariableView[])
  }

  // Sync edited values when environment changes
  useEffect(() => {
    if (activeEnv) {
      setEditedName(activeEnv.name)
      setEditedDescription(activeEnv.description || '')
      setSettingsChanged(false)
    }
    setLocalOverrides({})
  }, [activeEnv?.id])

  // Clear local overrides buffer when server data refreshes
  useEffect(() => {
    setLocalOverrides({})
  }, [variablesData])

  // Drag & drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4'
    }
  }, [])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const fromIndex = dragIndex
    setDragIndex(null)
    setDragOverIndex(null)

    if (fromIndex === null || fromIndex === dropIndex || !activeEnvironmentId) return

    const list = [...variablesList]
    const [moved] = list.splice(fromIndex, 1)
    list.splice(dropIndex, 0, moved)
    const keys = list.map((v) => v.key)

    await environmentsApi.reorderVariables(activeEnvironmentId, keys)
    refetch()
  }, [dragIndex, variablesList, activeEnvironmentId, refetch])

  if (!showEnvironmentModal) return null

  const handleAddVariable = async () => {
    if (!activeEnvironmentId || !newKey.trim()) return

    await environmentsApi.setVariable(activeEnvironmentId, newKey.trim(), {
      value: newValue,
      type: 'string',
      isSecret: newIsSecret,
      category: newCategory,
    })
    setNewKey('')
    setNewValue('')
    setNewIsSecret(false)
    setNewCategory('input')
    refetch()
  }

  const handleToggleSecret = async (key: string, currentIsSecret: boolean) => {
    if (!activeEnvironmentId) return
    const variable = variablesList.find(v => v.key === key)
    if (!variable) return

    await environmentsApi.setVariable(activeEnvironmentId, key, {
      value: variable.teamValue,
      type: variable.type || 'string',
      isSecret: !currentIsSecret,
      category: variable.category,
    })
    refetch()
  }

  const handleToggleCategory = async (key: string, currentCategory: string) => {
    if (!activeEnvironmentId) return
    const variable = variablesList.find(v => v.key === key)
    if (!variable) return

    const newCat = currentCategory === 'input' ? 'generated' : 'input'
    await environmentsApi.setVariable(activeEnvironmentId, key, {
      value: variable.teamValue,
      type: variable.type || 'string',
      isSecret: variable.isSecret,
      category: newCat,
    })
    refetch()
  }

  const handleToggleProtection = async (key: string) => {
    if (!activeEnvironmentId) return
    await environmentsApi.toggleProtection(activeEnvironmentId, key)
    refetch()
  }

  const handleSaveSettings = async () => {
    if (!activeEnvironmentId) return

    try {
      await environmentsApi.update(activeEnvironmentId, {
        name: editedName,
        description: editedDescription,
      })
      // Update local store
      setEnvironments(environments.map(env =>
        env.id === activeEnvironmentId
          ? { ...env, name: editedName, description: editedDescription }
          : env
      ))
      setSettingsChanged(false)
      queryClient.invalidateQueries({ queryKey: ['environments'] })
    } catch (error) {
      console.error('Failed to update environment:', error)
    }
  }

  const handleOverrideChange = (key: string, value: string) => {
    setLocalOverrides(prev => ({ ...prev, [key]: value }))
  }

  const handleOverrideBlur = async (key: string) => {
    if (!activeEnvironmentId) return
    const value = localOverrides[key]
    if (value === undefined) return

    // Confirm override on protected variables
    const variable = variablesList.find(v => v.key === key)
    if (variable?.isProtected && !canEditProtected && value !== '' && variable.localValue === null) {
      if (!confirm(t('environment.protectedOverrideConfirm'))) {
        setLocalOverrides(prev => {
          const next = { ...prev }
          delete next[key]
          return next
        })
        return
      }
    }

    await environmentsApi.setOverride(activeEnvironmentId, key, { value })
    refetch()
  }

  const handleResetOverride = async (key: string) => {
    if (!activeEnvironmentId) return
    await environmentsApi.deleteOverride(activeEnvironmentId, key)
    refetch()
  }

  const handleResetAllOverrides = async () => {
    if (!activeEnvironmentId) return
    if (confirm('Reset all local overrides to team values?')) {
      await environmentsApi.resetAllOverrides(activeEnvironmentId)
      refetch()
    }
  }

  const handlePromoteToTeam = async (key: string) => {
    if (!activeEnvironmentId) return
    const variable = variablesList.find(v => v.key === key)
    if (!variable || !variable.localValue) return

    if (confirm(t('environment.confirmPromoteToTeam').replace('{key}', key))) {
      // Set team value to the local override value
      await environmentsApi.setVariable(activeEnvironmentId, key, {
        value: variable.localValue,
        type: variable.type || 'string',
        isSecret: variable.isSecret,
        category: variable.category,
      })
      // Remove the local override
      await environmentsApi.deleteOverride(activeEnvironmentId, key)
      refetch()
    }
  }

  const handleStartOverride = async (key: string) => {
    if (!activeEnvironmentId) return
    const variable = variablesList.find(v => v.key === key)
    if (!variable) return

    // Confirm override on protected variables
    if (variable.isProtected && !canEditProtected) {
      if (!confirm(t('environment.protectedOverrideConfirm'))) {
        return
      }
    }

    // Copy team value to local override
    await environmentsApi.setOverride(activeEnvironmentId, key, { value: variable.teamValue })
    refetch()
  }

  const handleDeleteVariable = async (key: string) => {
    if (!activeEnvironmentId) return
    if (confirm(`Delete variable "${key}"?`)) {
      try {
        await environmentsApi.deleteVariable(activeEnvironmentId, key)
        refetch()
      } catch (err) {
        // Protected variable — show error
        alert((err as Error).message || 'Cannot delete protected variable')
      }
    }
  }

  return (
    <ResizableModal
      storageKey="environment"
      defaultWidth={1024}
      defaultHeight={Math.min(window.innerHeight * 0.8, 700)}
      minWidth={600}
      minHeight={400}
      onClose={() => setShowEnvironmentModal(false)}
    >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold">{t('environment.title')}: {activeEnv?.name || t('environment.none')}</h2>
            <p className="text-sm text-gray-500">{activeEnv?.description || t('environment.manageVariables')}</p>
          </div>
          <button
            onClick={() => setShowEnvironmentModal(false)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('variables')}
            className={clsx(
              'px-6 py-3 text-sm font-medium border-b-2 -mb-px',
              activeTab === 'variables'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {t('environment.variables')}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={clsx(
              'px-6 py-3 text-sm font-medium border-b-2 -mb-px',
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {t('environment.settings')}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'variables' && (
            <div>
              {/* Controls */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showSecrets}
                      onChange={(e) => setShowSecrets(e.target.checked)}
                      className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    />
                    {t('environment.showSecrets')}
                  </label>
                </div>
                <button
                  onClick={handleResetAllOverrides}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded hover:border-gray-400 dark:hover:border-gray-500"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('environment.resetAllOverrides')}
                </button>
              </div>

              {/* Variables table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="pb-2 w-8"></th>
                    <th className="pb-2 font-medium">{t('environment.key')}</th>
                    <th className="pb-2 font-medium w-16">{t('environment.category')}</th>
                    <th className="pb-2 font-medium">{t('common.value')}</th>
                    <th className="pb-2 font-medium">{t('environment.status')}</th>
                    <th className="pb-2 w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {variablesList.map((v, idx) => {
                    const isReadonly = v.isProtected && !canEditProtected
                    return (
                    <tr
                      key={v.key}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      className={clsx(
                        'border-t border-gray-200/50 dark:border-gray-700/50 transition-colors',
                        dragOverIndex === idx && dragIndex !== idx && 'bg-blue-900/20 border-t-blue-500',
                        dragIndex === idx && 'opacity-40',
                        v.isProtected && 'bg-amber-900/5 dark:bg-amber-900/10'
                      )}
                    >
                      <td className="py-3 pr-1">
                        <div className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400">
                          <GripVertical className="w-4 h-4" />
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2 font-mono text-gray-700 dark:text-gray-300">
                          {v.isSecret && (
                            <span title={t('environment.protected')}>
                              <Lock className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                            </span>
                          )}
                          {v.isProtected && (
                            <span title={t('environment.protectedReadonly')}>
                              <Shield className="w-3 h-3 text-amber-500 flex-shrink-0" />
                            </span>
                          )}
                          {v.key}
                        </div>
                        {v.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{v.description}</p>
                        )}
                        {v.isProtected && v.status === 'overridden' && !canEditProtected && (
                          <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 text-[10px] bg-amber-900/30 text-amber-400 border border-amber-700/50 rounded">
                            {t('environment.protectedOverrideWarning')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {isReadonly ? (
                          <span className={clsx(
                            'inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border opacity-60',
                            v.category === 'input'
                              ? 'bg-green-900/30 border-green-700/50 text-green-400'
                              : 'bg-purple-900/30 border-purple-700/50 text-purple-400'
                          )}>
                            {v.category === 'input' ? <Tag className="w-3 h-3" /> : <Cog className="w-3 h-3" />}
                            {v.category === 'input' ? t('environment.input') : t('environment.generated')}
                          </span>
                        ) : (
                        <button
                          onClick={() => handleToggleCategory(v.key, v.category)}
                          className={clsx(
                            'inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border cursor-pointer',
                            v.category === 'input'
                              ? 'bg-green-900/30 border-green-700/50 text-green-400'
                              : 'bg-purple-900/30 border-purple-700/50 text-purple-400'
                          )}
                          title={v.category === 'input' ? t('environment.inputVar') : t('environment.generatedVar')}
                        >
                          {v.category === 'input' ? <Tag className="w-3 h-3" /> : <Cog className="w-3 h-3" />}
                          {v.category === 'input' ? t('environment.input') : t('environment.generated')}
                        </button>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="space-y-1">
                          <div className={clsx(
                            'px-2 py-1 font-mono text-xs',
                            v.status === 'overridden' ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'
                          )}>
                            <span className="text-[10px] text-blue-400/70 mr-1">[{t('environment.team')}]</span>
                            {v.isSecret && !showSecrets ? '••••••••' : v.teamValue || '-'}
                          </div>
                          <input
                            type={v.isSecret && !showSecrets ? 'password' : 'text'}
                            value={localOverrides[v.key] ?? v.localValue ?? ''}
                            onChange={(e) => handleOverrideChange(v.key, e.target.value)}
                            onBlur={() => handleOverrideBlur(v.key)}
                            placeholder={isReadonly ? t('environment.protectedReadonly') : t('environment.overridePlaceholder')}
                            className={clsx(
                              'w-full px-2 py-1 bg-white dark:bg-gray-800 border rounded text-sm font-mono focus:outline-none focus:border-blue-500',
                              v.isProtected && v.status === 'overridden' && !canEditProtected
                                ? 'border-amber-600/50'
                                : 'border-gray-200 dark:border-gray-700'
                            )}
                          />
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() =>
                              v.status === 'overridden'
                                ? handlePromoteToTeam(v.key)
                                : handleStartOverride(v.key)
                            }
                            className={clsx(
                              'inline-flex items-center px-2 py-0.5 text-xs rounded cursor-pointer transition-colors',
                              v.status === 'overridden'
                                ? 'bg-blue-900/50 text-blue-400 hover:bg-blue-800/60'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                            )}
                            title={
                              v.status === 'overridden'
                                ? t('environment.clickToPromoteToTeam')
                                : t('environment.clickToOverride')
                            }
                          >
                            [{t(`environment.${v.status}`)}]
                          </button>
                          {v.isProtected && (
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] bg-amber-900/30 text-amber-500 rounded">
                              <Shield className="w-3 h-3 mr-0.5" />
                              {t('environment.protectedBadge')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          {/* Protection toggle — only for owner/admin */}
                          {canEditProtected && (
                            <button
                              onClick={() => handleToggleProtection(v.key)}
                              className={clsx(
                                'p-1',
                                v.isProtected ? 'text-amber-500 hover:text-amber-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                              )}
                              title={v.isProtected ? t('environment.unprotectVariable') : t('environment.protectVariable')}
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          )}
                          {!isReadonly && (
                            <button
                              onClick={() => handleToggleSecret(v.key, v.isSecret)}
                              className={clsx(
                                'p-1',
                                v.isSecret ? 'text-yellow-500 hover:text-yellow-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                              )}
                              title={v.isSecret ? t('environment.makeVisible') : t('environment.markAsProtected')}
                            >
                              {v.isSecret ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
                          )}
                          {v.status === 'overridden' && (
                            <button
                              onClick={() => handleResetOverride(v.key)}
                              className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                              title={t('environment.resetToTeamValue')}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          {!isReadonly && (
                            <button
                              onClick={() => handleDeleteVariable(v.key)}
                              className="p-1 text-gray-500 hover:text-red-400"
                              title={t('environment.deleteVariable')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>

              {variablesList.length === 0 && (
                <p className="py-8 text-center text-gray-500">{t('environment.noVariables')}</p>
              )}

              {/* Add new variable */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder={t('environment.key')}
                  className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                />
                <input
                  type={newIsSecret ? 'password' : 'text'}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={t('common.value')}
                  className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => setNewCategory(newCategory === 'input' ? 'generated' : 'input')}
                  className={clsx(
                    'p-2 rounded border',
                    newCategory === 'input'
                      ? 'bg-green-900/30 border-green-700/50 text-green-400'
                      : 'bg-purple-900/30 border-purple-700/50 text-purple-400'
                  )}
                  title={newCategory === 'input' ? t('environment.inputVar') : t('environment.generatedVar')}
                >
                  {newCategory === 'input' ? <Tag className="w-4 h-4" /> : <Cog className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setNewIsSecret(!newIsSecret)}
                  className={clsx(
                    'p-2 rounded border',
                    newIsSecret
                      ? 'bg-yellow-900/30 border-yellow-600 text-yellow-500'
                      : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
                  )}
                  title={newIsSecret ? t('environment.protectedClickToMakeVisible') : t('environment.visibleClickToProtect')}
                >
                  {newIsSecret ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleAddVariable}
                  disabled={!newKey.trim()}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 rounded text-sm text-white"
                >
                  <Plus className="w-4 h-4" />
                  {t('environment.addVariable')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">{t('environment.name')}</label>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => {
                    setEditedName(e.target.value)
                    setSettingsChanged(true)
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">{t('environment.description')}</label>
                <textarea
                  value={editedDescription}
                  onChange={(e) => {
                    setEditedDescription(e.target.value)
                    setSettingsChanged(true)
                  }}
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm resize-none focus:outline-none focus:border-blue-500"
                />
              </div>
              {settingsChanged && (
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleSaveSettings}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                  >
                    {t('environment.saveChanges')}
                  </button>
                  <button
                    onClick={() => {
                      setEditedName(activeEnv?.name || '')
                      setEditedDescription(activeEnv?.description || '')
                      setSettingsChanged(false)
                    }}
                    className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded text-sm"
                  >
                    {t('environment.cancel')}
                  </button>
                </div>
              )}

              {/* Group assignment */}
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
                  {t('group.assignment')}
                </label>
                {activeEnv?.group ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm bg-purple-900/30 text-purple-400 border border-purple-700/50 rounded">
                      <Users className="w-3.5 h-3.5" />
                      {activeEnv.group.name}
                    </span>
                    <button
                      onClick={() => {
                        if (activeEnvironmentId && confirm(t('group.confirmUnassign'))) {
                          unassignFromGroup.mutate({ groupId: activeEnv.group!.id, environmentId: activeEnvironmentId })
                        }
                      }}
                      disabled={unassignFromGroup.isPending}
                      className="px-2 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 border border-red-700/50 rounded"
                    >
                      {t('group.unassign')}
                    </button>
                  </div>
                ) : (
                  <div>
                    <select
                      value=""
                      onChange={(e) => {
                        const groupId = e.target.value
                        if (groupId && activeEnvironmentId && confirm(t('group.confirmAssign'))) {
                          assignToGroup.mutate({ groupId, environmentId: activeEnvironmentId })
                        }
                      }}
                      disabled={assignToGroup.isPending}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="">{t('group.selectGroup')}</option>
                      {(groupsData as Array<{ id: string; name: string }> || []).map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {t('group.assignHelp')}
                    </p>
                  </div>
                )}
              </div>

              {/* Delete environment */}
              <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-red-400 mb-2">{t('environment.dangerZone')}</h3>
                <p className="text-xs text-gray-500 mb-3">{t('environment.deleteWarning')}</p>
                <button
                  onClick={() => {
                    if (!activeEnvironmentId) return
                    if (confirm(t('environment.confirmDelete').replace('{name}', activeEnv?.name || ''))) {
                      deleteEnvironment.mutate(activeEnvironmentId)
                      setShowEnvironmentModal(false)
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-white hover:bg-red-600 border border-red-300 dark:border-red-700 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('environment.deleteEnvironment')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowEnvironmentModal(false)}
            className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            {t('environment.close')}
          </button>
        </div>
    </ResizableModal>
  )
}
