import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { clsx } from 'clsx'
import { Check, X, Copy, Download } from 'lucide-react'
import { useAppStore } from '../stores/app'
import { useTranslation } from '../hooks/useTranslation'
import type { HttpResponse } from '@api-client/shared'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-400'
  if (status >= 300 && status < 400) return 'text-blue-400'
  if (status >= 400 && status < 500) return 'text-yellow-400'
  if (status >= 500) return 'text-red-400'
  return 'text-gray-400'
}

function StatusBadge({ response }: { response: HttpResponse }) {
  const color = getStatusColor(response.status)

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className={clsx('font-semibold', color)}>
        {response.status} {response.statusText || 'OK'}
      </span>
      <span className="text-gray-400">{formatTime(response.time)}</span>
      <span className="text-gray-400">{formatSize(response.size)}</span>
    </div>
  )
}

function BodyTab({ response }: { response: HttpResponse }) {
  const [copied, setCopied] = useState(false)

  const isJson =
    response.headers['content-type']?.includes('application/json') ||
    (response.body.startsWith('{') || response.body.startsWith('['))

  let formattedBody = response.body
  if (isJson) {
    try {
      formattedBody = JSON.stringify(JSON.parse(response.body), null, 2)
    } catch {
      // Not valid JSON
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(response.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([response.body], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'response.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end gap-2 p-2 border-b border-gray-700">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white"
        >
          <Download className="w-3 h-3" />
          Download
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {isJson ? (
          <CodeMirror
            value={formattedBody}
            height="100%"
            theme="dark"
            extensions={[json()]}
            editable={false}
            className="h-full"
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: false,
            }}
          />
        ) : (
          <pre className="p-4 text-sm font-mono text-gray-300 whitespace-pre-wrap">{response.body}</pre>
        )}
      </div>
    </div>
  )
}

function HeadersTab({ response }: { response: HttpResponse }) {
  return (
    <div className="p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase">
            <th className="pb-2 font-medium">Header</th>
            <th className="pb-2 font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(response.headers).map(([key, value]) => (
            <tr key={key} className="border-t border-gray-700/50">
              <td className="py-2 pr-4 font-mono text-gray-400">{key}</td>
              <td className="py-2 font-mono text-gray-300 break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TestsTab() {
  const scriptTests = useAppStore((s) => s.scriptTests)

  const passed = scriptTests.filter((t) => t.passed).length
  const failed = scriptTests.filter((t) => !t.passed).length

  return (
    <div className="p-4">
      {scriptTests.length === 0 ? (
        <p className="text-gray-500 text-sm">No tests run. Add tests in the Scripts tab.</p>
      ) : (
        <>
          <div className="flex gap-4 mb-4 text-sm">
            <span className="text-green-400">{passed} passed</span>
            <span className={failed > 0 ? 'text-red-400' : 'text-gray-500'}>{failed} failed</span>
          </div>
          <div className="space-y-2">
            {scriptTests.map((test, i) => (
              <div
                key={i}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded text-sm',
                  test.passed ? 'bg-green-900/30' : 'bg-red-900/30'
                )}
              >
                {test.passed ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <X className="w-4 h-4 text-red-400" />
                )}
                <span className="text-gray-300">{test.name}</span>
                <span className="text-gray-500 text-xs">[{test.source}]</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ConsoleTab() {
  const scriptLogs = useAppStore((s) => s.scriptLogs)
  const scriptErrors = useAppStore((s) => s.scriptErrors)

  const allMessages = [
    ...scriptLogs.map((l) => ({ ...l, type: 'log' as const })),
    ...scriptErrors.map((e) => ({ ...e, type: 'error' as const })),
  ]

  return (
    <div className="p-4 font-mono text-sm">
      {allMessages.length === 0 ? (
        <p className="text-gray-500">No console output. Use console.log() in scripts.</p>
      ) : (
        <div className="space-y-1">
          {allMessages.map((msg, i) => (
            <div
              key={i}
              className={clsx(
                'flex gap-2',
                msg.type === 'error' ? 'text-red-400' : 'text-gray-300'
              )}
            >
              <span className="text-gray-500">[{msg.source}]</span>
              <span>{msg.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ResponseViewer() {
  const currentResponse = useAppStore((s) => s.currentResponse)
  const isLoading = useAppStore((s) => s.isLoading)
  const responseTab = useAppStore((s) => s.responseTab)
  const setResponseTab = useAppStore((s) => s.setResponseTab)
  const { t } = useTranslation()

  const tabs = [
    { id: 'body', label: t('response.tabs.body') },
    { id: 'headers', label: t('response.tabs.headers') },
    { id: 'tests', label: t('response.tabs.tests') },
    { id: 'console', label: t('response.tabs.console') },
  ] as const

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>{t('response.sending')}</span>
        </div>
      </div>
    )
  }

  if (!currentResponse) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>{t('response.sendRequest')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800/50">
        <StatusBadge response={currentResponse} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setResponseTab(tab.id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
              responseTab === tab.id
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
        {responseTab === 'body' && <BodyTab response={currentResponse} />}
        {responseTab === 'headers' && <HeadersTab response={currentResponse} />}
        {responseTab === 'tests' && <TestsTab />}
        {responseTab === 'console' && <ConsoleTab />}
      </div>
    </div>
  )
}
