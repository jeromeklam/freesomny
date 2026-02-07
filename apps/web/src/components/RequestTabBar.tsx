import { X } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore, type OpenTab } from '../stores/app'

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
  HEAD: 'text-gray-400',
  OPTIONS: 'text-gray-400',
}

function Tab({ tab, isActive }: { tab: OpenTab; isActive: boolean }) {
  const setActiveRequestTab = useAppStore((s) => s.setActiveRequestTab)
  const closeRequestTab = useAppStore((s) => s.closeRequestTab)

  return (
    <div
      className={clsx(
        'flex items-center gap-2 px-3 py-1.5 border-r border-gray-700 cursor-pointer group min-w-0 max-w-[200px]',
        isActive ? 'bg-gray-800' : 'bg-gray-900 hover:bg-gray-800/50'
      )}
      onClick={() => setActiveRequestTab(tab.id)}
    >
      <span className={clsx('text-xs font-mono font-semibold shrink-0', METHOD_COLORS[tab.method] || 'text-gray-400')}>
        {tab.method.substring(0, 3)}
      </span>
      <span className="text-sm truncate flex-1">{tab.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          closeRequestTab(tab.id)
        }}
        className={clsx(
          'p-0.5 rounded hover:bg-gray-600 shrink-0',
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
      >
        <X className="w-3 h-3 text-gray-400" />
      </button>
    </div>
  )
}

export function RequestTabBar() {
  const openTabs = useAppStore((s) => s.openTabs)
  const activeRequestTabId = useAppStore((s) => s.activeRequestTabId)

  if (openTabs.length === 0) {
    return null
  }

  return (
    <div className="flex items-center border-b border-gray-700 bg-gray-900 overflow-x-auto">
      {openTabs.map((tab) => (
        <Tab key={tab.id} tab={tab} isActive={tab.id === activeRequestTabId} />
      ))}
    </div>
  )
}
