import { useState } from 'react'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslation } from '../hooks/useTranslation'
import { ResizableModal } from './ResizableModal'
import { AdminDashboard } from './admin/AdminDashboard'
import { AdminUsers } from './admin/AdminUsers'
import { AdminGroups } from './admin/AdminGroups'
import { AdminAuditLog } from './admin/AdminAuditLog'

interface AdminModalProps {
  onClose: () => void
}

type AdminTab = 'dashboard' | 'users' | 'groups' | 'audit'

export function AdminModal({ onClose }: AdminModalProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')
  const { t } = useTranslation()

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'dashboard', label: t('admin.tabs.dashboard') },
    { id: 'users', label: t('admin.tabs.users') },
    { id: 'groups', label: t('admin.tabs.groups') },
    { id: 'audit', label: t('admin.tabs.audit') },
  ]

  return (
    <ResizableModal
      storageKey="admin"
      defaultWidth={900}
      defaultHeight={Math.min(window.innerHeight * 0.85, 700)}
      minWidth={600}
      minHeight={400}
      onClose={onClose}
      className="bg-gray-800"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold">{t('admin.title')}</h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'dashboard' && <AdminDashboard />}
        {activeTab === 'users' && <AdminUsers />}
        {activeTab === 'groups' && <AdminGroups />}
        {activeTab === 'audit' && <AdminAuditLog />}
      </div>
    </ResizableModal>
  )
}
