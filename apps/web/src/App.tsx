import { useEffect, useState, useCallback, useRef } from 'react'
import { Settings, Clock, Upload, Globe } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from './stores/app'
import { useFolders, useEnvironments } from './hooks/useApi'
import { useTranslation } from './hooks/useTranslation'
import { languages, type Language } from './i18n'
import { FolderTree } from './components/FolderTree'
import { RequestBuilder } from './components/RequestBuilder'
import { ResponseViewer } from './components/ResponseViewer'
import { EnvironmentSelector } from './components/EnvironmentSelector'
import { EnvironmentModal } from './components/EnvironmentModal'
import { History } from './components/History'
import { FolderSettings } from './components/FolderSettings'
import { ImportModal } from './components/ImportModal'

function App() {
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false)
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [requestPanelHeight, setRequestPanelHeight] = useState(50) // percentage
  const splitContainerRef = useRef<HTMLDivElement>(null)

  const sidebarWidth = useAppStore((s) => s.sidebarWidth)
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth)
  const setShowHistory = useAppStore((s) => s.setShowHistory)
  const setShowSettings = useAppStore((s) => s.setShowSettings)
  const selectedFolderId = useAppStore((s) => s.selectedFolderId)
  const selectedRequestId = useAppStore((s) => s.selectedRequestId)

  const { t, language, setLanguage } = useTranslation()

  // Load initial data
  useFolders()
  useEnvironments()

  // Handle sidebar resize
  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingSidebar(true)
  }, [])

  // Handle horizontal splitter resize
  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingSplitter(true)
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsDraggingSidebar(false)
    setIsDraggingSplitter(false)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDraggingSidebar) {
        const newWidth = Math.max(200, Math.min(600, e.clientX))
        setSidebarWidth(newWidth)
      }
      if (isDraggingSplitter && splitContainerRef.current) {
        const rect = splitContainerRef.current.getBoundingClientRect()
        const relativeY = e.clientY - rect.top
        const percentage = (relativeY / rect.height) * 100
        // Clamp between 20% and 80%
        setRequestPanelHeight(Math.max(20, Math.min(80, percentage)))
      }
    },
    [isDraggingSidebar, isDraggingSplitter, setSidebarWidth]
  )

  useEffect(() => {
    if (isDraggingSidebar || isDraggingSplitter) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDraggingSidebar, isDraggingSplitter, handleMouseMove, handleMouseUp])

  return (
    <div className={clsx(
      'flex flex-col h-screen bg-gray-900 text-gray-100',
      (isDraggingSidebar || isDraggingSplitter) && 'select-none'
    )}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">FreeSomnia</h1>
        </div>

        <div className="flex items-center gap-2">
          <EnvironmentSelector />

          <button
            onClick={() => setShowImport(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title={t('header.import')}
          >
            <Upload className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowHistory(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title={t('header.history')}
          >
            <Clock className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title={t('header.settings')}
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Language selector */}
          <div className="flex items-center gap-1 ml-2 border-l border-gray-600 pl-2">
            <Globe className="w-4 h-4 text-gray-400" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-transparent text-sm text-gray-400 hover:text-white cursor-pointer focus:outline-none"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-gray-800">
                  {lang.code.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="flex flex-col border-r border-gray-700 bg-gray-900"
          style={{ width: sidebarWidth }}
        >
          <FolderTree />
        </aside>

        {/* Sidebar resize handle */}
        <div
          className={clsx(
            'w-1 cursor-col-resize hover:bg-blue-500 transition-colors bg-gray-700 flex-shrink-0 select-none relative',
            isDraggingSidebar && 'bg-blue-500'
          )}
          onMouseDown={handleSidebarMouseDown}
        >
          {/* Visual grip indicator */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center">
            <div className="w-px h-6 bg-gray-500 rounded-full" />
          </div>
        </div>

        {/* Main panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedFolderId && !selectedRequestId ? (
            /* Folder settings - full height when folder is selected */
            <div className="flex-1 overflow-hidden">
              <FolderSettings />
            </div>
          ) : (
            <div ref={splitContainerRef} className="flex flex-col h-full">
              {/* Request builder */}
              <div
                className="overflow-hidden"
                style={{ height: `calc(${requestPanelHeight}% - 2px)` }}
              >
                <RequestBuilder />
              </div>

              {/* Horizontal splitter */}
              <div
                className={clsx(
                  'h-1 cursor-row-resize hover:bg-blue-500 transition-colors bg-gray-700 flex-shrink-0 select-none relative z-10',
                  isDraggingSplitter && 'bg-blue-500'
                )}
                onMouseDown={handleSplitterMouseDown}
              >
                {/* Visual grip indicator */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
                  <div className="w-6 h-px bg-gray-500 rounded-full" />
                </div>
              </div>

              {/* Response viewer */}
              <div
                className="overflow-hidden"
                style={{ height: `calc(${100 - requestPanelHeight}% - 2px)` }}
              >
                <ResponseViewer />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <EnvironmentModal />
      <History />
      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} />
    </div>
  )
}

export default App
