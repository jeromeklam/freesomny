import { useState } from 'react'
import { ChevronDown, Plus, Settings, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../stores/app'
import { useEnvironments, useCreateEnvironment, useActivateEnvironment } from '../hooks/useApi'

export function EnvironmentSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newEnvName, setNewEnvName] = useState('')

  const environments = useAppStore((s) => s.environments)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const setShowEnvironmentModal = useAppStore((s) => s.setShowEnvironmentModal)

  const { isLoading } = useEnvironments()
  const createEnvironment = useCreateEnvironment()
  const activateEnvironment = useActivateEnvironment()

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
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded hover:bg-gray-700"
      >
        <span className="text-gray-400">Env:</span>
        <span className="font-medium">{activeEnv?.name || 'No environment'}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-64 bg-gray-800 border border-gray-700 rounded shadow-lg">
            <div className="p-2">
              {environments.length === 0 && !isLoading ? (
                <p className="px-2 py-2 text-sm text-gray-500">No environments yet</p>
              ) : (
                environments.map((env) => (
                  <button
                    key={env.id}
                    onClick={() => handleActivate(env.id)}
                    className={clsx(
                      'w-full flex items-center justify-between px-3 py-2 text-sm rounded hover:bg-gray-700',
                      env.id === activeEnvironmentId && 'bg-gray-700'
                    )}
                  >
                    <span>{env.name}</span>
                    {env.id === activeEnvironmentId && <Check className="w-4 h-4 text-green-400" />}
                  </button>
                ))
              )}
            </div>

            <hr className="border-gray-700" />

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
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleCreate}
                    disabled={!newEnvName.trim()}
                    className="flex-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                >
                  <Plus className="w-4 h-4" />
                  New Environment
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setShowEnvironmentModal(true)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                >
                  <Settings className="w-4 h-4" />
                  Manage Environments
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
