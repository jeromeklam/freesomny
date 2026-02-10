import { useState } from 'react'
import { X, Trash2, Download, Upload } from 'lucide-react'
import { ResizableModal } from './ResizableModal'
import { clsx } from 'clsx'
import { useAppStore } from '../stores/app'
import { useTranslation } from '../hooks/useTranslation'
import { languages, type Language } from '../i18n'

type SettingsTab = 'general' | 'proxy' | 'ssl' | 'data'

export function SettingsModal() {
  const showSettings = useAppStore((s) => s.showSettings)
  const setShowSettings = useAppStore((s) => s.setShowSettings)
  const { t, language, setLanguage } = useTranslation()

  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [timeout, setTimeout] = useState(30000)
  const [proxyEnabled, setProxyEnabled] = useState(false)
  const [httpProxy, setHttpProxy] = useState('')
  const [httpsProxy, setHttpsProxy] = useState('')
  const [noProxy, setNoProxy] = useState('localhost,127.0.0.1')
  const [verifySsl, setVerifySsl] = useState(true)

  if (!showSettings) return null

  const tabs = [
    { id: 'general', label: t('settings.tabs.general') },
    { id: 'proxy', label: t('settings.tabs.proxy') },
    { id: 'ssl', label: t('settings.tabs.ssl') },
    { id: 'data', label: t('settings.tabs.data') },
  ] as const

  const inputClass =
    'w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500'
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
  const helpClass = 'text-xs text-gray-500 mt-1'

  const handleClearHistory = async () => {
    if (confirm(t('settings.data.clearHistoryConfirm'))) {
      try {
        await fetch('/api/history', { method: 'DELETE' })
      } catch (err) {
        console.error('Failed to clear history:', err)
      }
    }
  }

  return (
    <ResizableModal
      storageKey="settings"
      defaultWidth={672}
      defaultHeight={Math.min(window.innerHeight * 0.8, 600)}
      minWidth={400}
      minHeight={300}
      onClose={() => setShowSettings(false)}
      className="bg-white dark:bg-gray-800"
    >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Language */}
              <div>
                <label className={labelClass}>{t('settings.general.language')}</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className={inputClass}
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
                <p className={helpClass}>{t('settings.general.languageHelp')}</p>
              </div>

              {/* Default timeout */}
              <div>
                <label className={labelClass}>{t('settings.general.timeout')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={timeout}
                    onChange={(e) => setTimeout(Number(e.target.value))}
                    min={0}
                    step={1000}
                    className={clsx(inputClass, 'w-32')}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('settings.general.ms')}</span>
                </div>
                <p className={helpClass}>{t('settings.general.timeoutHelp')}</p>
              </div>
            </div>
          )}

          {activeTab === 'proxy' && (
            <div className="space-y-6">
              {/* Enable proxy */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="proxyEnabled"
                  checked={proxyEnabled}
                  onChange={(e) => setProxyEnabled(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
                <label htmlFor="proxyEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('settings.proxy.enableProxy')}
                </label>
              </div>

              {proxyEnabled && (
                <>
                  {/* HTTP Proxy */}
                  <div>
                    <label className={labelClass}>{t('settings.proxy.httpProxy')}</label>
                    <input
                      type="text"
                      value={httpProxy}
                      onChange={(e) => setHttpProxy(e.target.value)}
                      placeholder="http://proxy:8080"
                      className={inputClass}
                    />
                  </div>

                  {/* HTTPS Proxy */}
                  <div>
                    <label className={labelClass}>{t('settings.proxy.httpsProxy')}</label>
                    <input
                      type="text"
                      value={httpsProxy}
                      onChange={(e) => setHttpsProxy(e.target.value)}
                      placeholder="http://proxy:8080"
                      className={inputClass}
                    />
                  </div>

                  {/* No Proxy */}
                  <div>
                    <label className={labelClass}>{t('settings.proxy.noProxy')}</label>
                    <input
                      type="text"
                      value={noProxy}
                      onChange={(e) => setNoProxy(e.target.value)}
                      className={inputClass}
                    />
                    <p className={helpClass}>{t('settings.proxy.noProxyHelp')}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'ssl' && (
            <div className="space-y-6">
              {/* Verify SSL */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="verifySsl"
                  checked={verifySsl}
                  onChange={(e) => setVerifySsl(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
                <label htmlFor="verifySsl" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('settings.ssl.verifyCertificates')}
                </label>
              </div>
              <p className={clsx(helpClass, 'mt-0 -translate-y-4 ml-7')}>
                {t('settings.ssl.verifyCertificatesHelp')}
              </p>

              {/* Client cert */}
              <div>
                <label className={labelClass}>{t('settings.ssl.clientCert')}</label>
                <div className="flex gap-2">
                  <input type="text" disabled placeholder="No file selected" className={clsx(inputClass, 'flex-1 opacity-60')} />
                  <button className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600">
                    {t('settings.ssl.browse')}
                  </button>
                </div>
              </div>

              {/* Client key */}
              <div>
                <label className={labelClass}>{t('settings.ssl.clientKey')}</label>
                <div className="flex gap-2">
                  <input type="text" disabled placeholder="No file selected" className={clsx(inputClass, 'flex-1 opacity-60')} />
                  <button className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600">
                    {t('settings.ssl.browse')}
                  </button>
                </div>
              </div>

              {/* CA cert */}
              <div>
                <label className={labelClass}>{t('settings.ssl.caCert')}</label>
                <div className="flex gap-2">
                  <input type="text" disabled placeholder="No file selected" className={clsx(inputClass, 'flex-1 opacity-60')} />
                  <button className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600">
                    {t('settings.ssl.browse')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-6">
              {/* Clear history */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.data.clearHistory')}</h3>
                  <p className={helpClass}>{t('settings.data.clearHistoryHelp')}</p>
                </div>
                <button
                  onClick={handleClearHistory}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('settings.data.clearHistory')}
                </button>
              </div>

              {/* Export data */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.data.exportData')}</h3>
                  <p className={helpClass}>{t('settings.data.exportDataHelp')}</p>
                </div>
                <button className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-sm rounded">
                  <Download className="w-4 h-4" />
                  {t('settings.data.exportData')}
                </button>
              </div>

              {/* Import data */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.data.importData')}</h3>
                  <p className={helpClass}>{t('settings.data.importDataHelp')}</p>
                </div>
                <button className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-sm rounded">
                  <Upload className="w-4 h-4" />
                  {t('settings.data.importData')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowSettings(false)}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            {t('common.close')}
          </button>
        </div>
    </ResizableModal>
  )
}
