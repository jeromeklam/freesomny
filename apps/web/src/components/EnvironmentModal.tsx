import { useState, useEffect } from 'react'
import { X, Plus, Trash2, RotateCcw, Lock, Unlock } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../stores/app'
import { useEnvironmentVariables } from '../hooks/useApi'
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
  status: 'team' | 'overridden'
}

export function EnvironmentModal() {
  const [activeTab, setActiveTab] = useState<'variables' | 'settings'>('variables')
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newIsSecret, setNewIsSecret] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [settingsChanged, setSettingsChanged] = useState(false)

  const showEnvironmentModal = useAppStore((s) => s.showEnvironmentModal)
  const setShowEnvironmentModal = useAppStore((s) => s.setShowEnvironmentModal)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const environments = useAppStore((s) => s.environments)
  const setEnvironments = useAppStore((s) => s.setEnvironments)

  const { data: variables, refetch } = useEnvironmentVariables(activeEnvironmentId)
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId)

  // Sync edited values when environment changes
  useEffect(() => {
    if (activeEnv) {
      setEditedName(activeEnv.name)
      setEditedDescription(activeEnv.description || '')
      setSettingsChanged(false)
    }
  }, [activeEnv?.id])

  if (!showEnvironmentModal) return null

  const handleAddVariable = async () => {
    if (!activeEnvironmentId || !newKey.trim()) return

    await environmentsApi.setVariable(activeEnvironmentId, newKey.trim(), {
      value: newValue,
      type: 'string',
      isSecret: newIsSecret,
    })
    setNewKey('')
    setNewValue('')
    setNewIsSecret(false)
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
    })
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

  const handleSetOverride = async (key: string, value: string) => {
    if (!activeEnvironmentId) return
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

  const handleDeleteVariable = async (key: string) => {
    if (!activeEnvironmentId) return
    if (confirm(`Delete variable "${key}"?`)) {
      await environmentsApi.deleteVariable(activeEnvironmentId, key)
      refetch()
    }
  }

  const variablesList = (variables || []) as VariableView[]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-4xl max-h-[80vh] bg-gray-900 border border-gray-700 rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold">{t('environment.title')}: {activeEnv?.name || t('environment.none')}</h2>
            <p className="text-sm text-gray-500">{activeEnv?.description || t('environment.manageVariables')}</p>
          </div>
          <button
            onClick={() => setShowEnvironmentModal(false)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('variables')}
            className={clsx(
              'px-6 py-3 text-sm font-medium border-b-2 -mb-px',
              activeTab === 'variables'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
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
                : 'border-transparent text-gray-400 hover:text-gray-300'
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
                      className="w-4 h-4 rounded bg-gray-700 border-gray-600"
                    />
                    {t('environment.showSecrets')}
                  </label>
                </div>
                <button
                  onClick={handleResetAllOverrides}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-600 rounded hover:border-gray-500"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('environment.resetAllOverrides')}
                </button>
              </div>

              {/* Variables table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="pb-2 font-medium">{t('environment.key')}</th>
                    <th className="pb-2 font-medium">{t('environment.teamValue')}</th>
                    <th className="pb-2 font-medium">{t('environment.yourValue')}</th>
                    <th className="pb-2 font-medium">{t('environment.status')}</th>
                    <th className="pb-2 w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {variablesList.map((v) => (
                    <tr key={v.key} className="border-t border-gray-700/50">
                      <td className="py-3 pr-4 font-mono text-gray-300">
                        <div className="flex items-center gap-2">
                          {v.isSecret && (
                            <span title={t('environment.protected')}>
                              <Lock className="w-3 h-3 text-yellow-500" />
                            </span>
                          )}
                          {v.key}
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-gray-400">
                        {v.isSecret && !showSecrets ? '••••••••' : v.teamValue || '-'}
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type={v.isSecret && !showSecrets ? 'password' : 'text'}
                          value={v.localValue ?? ''}
                          onChange={(e) => handleSetOverride(v.key, e.target.value)}
                          placeholder="-"
                          className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={clsx(
                            'inline-flex items-center px-2 py-0.5 text-xs rounded',
                            v.status === 'overridden'
                              ? 'bg-blue-900/50 text-blue-400'
                              : 'bg-gray-700 text-gray-400'
                          )}
                        >
                          [{t(`environment.${v.status}`)}]
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleSecret(v.key, v.isSecret)}
                            className={clsx(
                              'p-1',
                              v.isSecret ? 'text-yellow-500 hover:text-yellow-400' : 'text-gray-500 hover:text-white'
                            )}
                            title={v.isSecret ? t('environment.makeVisible') : t('environment.markAsProtected')}
                          >
                            {v.isSecret ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                          {v.status === 'overridden' && (
                            <button
                              onClick={() => handleResetOverride(v.key)}
                              className="p-1 text-gray-500 hover:text-white"
                              title={t('environment.resetToTeamValue')}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteVariable(v.key)}
                            className="p-1 text-gray-500 hover:text-red-400"
                            title={t('environment.deleteVariable')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {variablesList.length === 0 && (
                <p className="py-8 text-center text-gray-500">{t('environment.noVariables')}</p>
              )}

              {/* Add new variable */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-700">
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder={t('environment.key')}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                />
                <input
                  type={newIsSecret ? 'password' : 'text'}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={t('common.value')}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => setNewIsSecret(!newIsSecret)}
                  className={clsx(
                    'p-2 rounded border',
                    newIsSecret
                      ? 'bg-yellow-900/30 border-yellow-600 text-yellow-500'
                      : 'border-gray-600 text-gray-400 hover:border-gray-500'
                  )}
                  title={newIsSecret ? t('environment.protectedClickToMakeVisible') : t('environment.visibleClickToProtect')}
                >
                  {newIsSecret ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleAddVariable}
                  disabled={!newKey.trim()}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded text-sm"
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
                <label className="block text-sm text-gray-400 mb-1">{t('environment.name')}</label>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => {
                    setEditedName(e.target.value)
                    setSettingsChanged(true)
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('environment.description')}</label>
                <textarea
                  value={editedDescription}
                  onChange={(e) => {
                    setEditedDescription(e.target.value)
                    setSettingsChanged(true)
                  }}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm resize-none focus:outline-none focus:border-blue-500"
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
                    className="px-4 py-2 text-gray-400 hover:text-white rounded text-sm"
                  >
                    {t('environment.cancel')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-700">
          <button
            onClick={() => setShowEnvironmentModal(false)}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white"
          >
            {t('environment.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
