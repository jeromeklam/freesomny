import { useState } from 'react'
import { ChevronDown, Plus, Check, Trash2, Copy, Pencil, Lock, Unlock } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../stores/app'
import { useEnvironments, useCreateEnvironment, useActivateEnvironment, useDeleteEnvironment, useDuplicateEnvironment } from '../hooks/useApi'
import { useTranslation } from '../hooks/useTranslation'

export function EnvironmentSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newEnvName, setNewEnvName] = useState('')

  const environments = useAppStore((s) => s.environments)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const setShowEnvironmentModal = useAppStore((s) => s.setShowEnvironmentModal)
  const lockEnvPerTab = useAppStore((s) => s.lockEnvPerTab)
  const setLockEnvPerTab = useAppStore((s) => s.setLockEnvPerTab)

  const { isLoading } = useEnvironments()
  const createEnvironment = useCreateEnvironment()
  const activateEnvironment = useActivateEnvironment()
  const deleteEnvironment = useDeleteEnvironment()
  const duplicateEnvironment = useDuplicateEnvironment()
  const { t } = useTranslation()

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId)

  const handleActivate = (id: string) => {
    activateEnvironment.mutate(id)
    setIsOpen(false)
  }

  const handleCreate = () => {
    if (newEnvName.trim()) {
      createEnvironment.mutate(
        { name: newEnvName.trim(), isActive: true },
        {
          onSuccess: () => {
            setNewEnvName('')
            setShowCreate(false)
          },
        }
      )
    }
  }

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => setLockEnvPerTab(!lockEnvPerTab)}
        className={clsx(
          'p-1.5 rounded transition-colors',
          lockEnvPerTab
            ? 'text-amber-500 hover:text-amber-400 bg-amber-500/10'
            : 'text-gray-400 hover:text-gray-300'
        )}
        title={lockEnvPerTab ? t('environment.unlockPerTab') : t('environment.lockPerTab')}
      >
        {lockEnvPerTab ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        <span className="text-gray-500 dark:text-gray-400">Env:</span>
        <span className="font-medium max-w-[300px] truncate">{activeEnv?.name || 'No environment'}</span>
        <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[16rem] w-max max-w-[28rem] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            <div className="p-1.5">
              {environments.length === 0 && !isLoading ? (
                <p className="px-3 py-2 text-sm text-gray-500">No environments yet</p>
              ) : (
                environments.map((env) => (
                  <div
                    key={env.id}
                    className={clsx(
                      'flex items-center gap-2 px-2.5 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/60 group cursor-pointer transition-colors',
                      env.id === activeEnvironmentId && 'bg-blue-50 dark:bg-blue-900/20'
                    )}
                    onClick={() => handleActivate(env.id)}
                  >
                    <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                      {env.id === activeEnvironmentId && <Check className="w-4 h-4 text-green-500" />}
                    </span>
                    <span className={clsx(
                      'flex-1 whitespace-nowrap',
                      env.id === activeEnvironmentId ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                    )}>
                      {env.name}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          activateEnvironment.mutate(env.id)
                          setIsOpen(false)
                          setShowEnvironmentModal(true)
                        }}
                        className="p-1 text-gray-400 hover:text-yellow-400 rounded transition-colors"
                        title={t('environment.editEnvironment')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          duplicateEnvironment.mutate(env.id)
                        }}
                        className="p-1 text-gray-400 hover:text-blue-400 rounded transition-colors"
                        title={t('environment.duplicateEnvironment')}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(t('environment.confirmDelete').replace('{name}', env.name))) {
                            deleteEnvironment.mutate(env.id)
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-red-400 rounded transition-colors"
                        title={t('environment.deleteEnvironment')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            {showCreate ? (
              <div className="p-2">
                <input
                  type="text"
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') setShowCreate(false)
                  }}
                  placeholder="Environment name"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleCreate}
                    disabled={!newEnvName.trim()}
                    className="flex-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-md"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-1.5">
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded-md transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Environment
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
