import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { search, setSearchQuery, SearchQuery, findNext, findPrevious, SearchCursor } from '@codemirror/search'
import { clsx } from 'clsx'
import { Check, X, Copy, Download, AlertCircle, Variable, Plus, Search, ChevronUp, ChevronDown, Image, FileDown, Code, Eye } from 'lucide-react'
import { useAppStore } from '../stores/app'
import { useTranslation } from '../hooks/useTranslation'
import { useEnvironmentVariables, useSetEnvironmentVariable } from '../hooks/useApi'
import type { HttpResponse } from '@api-client/shared'

// --- Types ---

interface SearchNavHandle {
  next: () => void
  prev: () => void
}

interface MatchInfo {
  current: number
  total: number
}

// --- Utilities ---

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

// Highlight matching text with current match distinguished
function HighlightedText({
  text,
  search: searchTerm,
  currentMatchIndex,
  globalOffset = 0,
}: {
  text: string
  search: string
  currentMatchIndex?: number
  globalOffset?: number
}) {
  if (!searchTerm) return <>{text}</>

  const parts: Array<{ text: string; match: boolean; matchIdx: number }> = []
  const lower = text.toLowerCase()
  const needle = searchTerm.toLowerCase()
  let lastIndex = 0
  let matchIdx = globalOffset

  let idx = lower.indexOf(needle, lastIndex)
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push({ text: text.slice(lastIndex, idx), match: false, matchIdx: -1 })
    }
    parts.push({ text: text.slice(idx, idx + needle.length), match: true, matchIdx })
    matchIdx++
    lastIndex = idx + needle.length
    idx = lower.indexOf(needle, lastIndex)
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), match: false, matchIdx: -1 })
  }

  if (parts.length === 0) return <>{text}</>

  return (
    <>
      {parts.map((p, i) =>
        p.match ? (
          <mark
            key={i}
            data-match-index={p.matchIdx}
            className={clsx(
              'rounded-sm px-0.5',
              currentMatchIndex !== undefined && p.matchIdx === currentMatchIndex
                ? 'bg-orange-500/60 text-orange-100'
                : 'bg-yellow-500/40 text-yellow-200'
            )}
          >
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  )
}

function countMatches(text: string, needle: string): number {
  if (!needle) return 0
  const lower = text.toLowerCase()
  const n = needle.toLowerCase()
  let count = 0
  let idx = lower.indexOf(n)
  while (idx !== -1) {
    count++
    idx = lower.indexOf(n, idx + n.length)
  }
  return count
}

// --- Components ---

function StatusBadge({ response }: { response: HttpResponse }) {
  const color = getStatusColor(response.status)

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className={clsx('font-semibold', color)}>
        {response.status} {response.statusText || 'OK'}
      </span>
      <span className="text-gray-500 dark:text-gray-400">{formatTime(response.time)}</span>
      <span className="text-gray-500 dark:text-gray-400">{formatSize(response.size)}</span>
    </div>
  )
}

// Detect content type categories
function getContentCategory(contentType: string): 'image' | 'binary' | 'json' | 'text' {
  const ct = (contentType || '').toLowerCase()
  if (ct.startsWith('image/')) return 'image'
  if (ct.includes('application/json') || ct.includes('application/vnd.api+json')) return 'json'
  if (
    ct.startsWith('audio/') || ct.startsWith('video/') || ct.startsWith('font/') ||
    ct === 'application/octet-stream' || ct === 'application/pdf' ||
    ct.includes('application/zip') || ct.includes('application/gzip')
  ) return 'binary'
  return 'text'
}

function getImageMimeType(contentType: string): string {
  const ct = (contentType || '').toLowerCase()
  const match = ct.match(/^(image\/[a-z0-9.+-]+)/)
  return match ? match[1] : 'image/png'
}

function getFileExtension(contentType: string): string {
  const ct = (contentType || '').toLowerCase()
  const map: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
    'image/svg+xml': 'svg', 'image/bmp': 'bmp', 'image/x-icon': 'ico', 'image/avif': 'avif',
    'application/pdf': 'pdf', 'application/zip': 'zip', 'application/gzip': 'gz',
    'application/octet-stream': 'bin',
  }
  for (const [mime, ext] of Object.entries(map)) {
    if (ct.includes(mime)) return ext
  }
  return 'bin'
}

function BodyTab({
  response,
  t,
  searchTerm,
  navRef,
  onMatchInfo,
}: {
  response: HttpResponse
  t: (key: string) => string
  searchTerm: string
  navRef: React.MutableRefObject<SearchNavHandle | null>
  onMatchInfo: (info: MatchInfo) => void
}) {
  const [copied, setCopied] = useState(false)
  const [htmlPreview, setHtmlPreview] = useState(false)
  const cmRef = useRef<ReactCodeMirrorRef>(null)
  const [plainMatchIndex, setPlainMatchIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const contentType = response.headers['content-type'] || ''
  const category = getContentCategory(contentType)
  const isBase64 = response.bodyEncoding === 'base64'
  const isImage = category === 'image' && isBase64
  const isBinary = category === 'binary' && isBase64

  const isJson = category === 'json' || (
    !isBase64 && (response.body.startsWith('{') || response.body.startsWith('['))
  )

  const isHtml = !isBase64 && !isJson && (
    contentType.toLowerCase().includes('text/html') ||
    response.body.trimStart().toLowerCase().startsWith('<!doctype') ||
    response.body.trimStart().toLowerCase().startsWith('<html')
  )

  let formattedBody = response.body
  if (isJson && !isBase64) {
    try {
      formattedBody = JSON.stringify(JSON.parse(response.body), null, 2)
    } catch {
      // Not valid JSON
    }
  }

  const searchExt = useMemo(() => search({ top: false, createPanel: () => ({ dom: document.createElement('span') }) }), [])

  // Sync search term to CodeMirror
  useEffect(() => {
    const view = cmRef.current?.view
    if (!view) return
    const query = new SearchQuery({ search: searchTerm || '', caseSensitive: false, literal: true })
    view.dispatch({ effects: setSearchQuery.of(query) })
  }, [searchTerm])

  const totalMatches = useMemo(() => {
    if (isImage || isBinary) return 0
    return countMatches(formattedBody, searchTerm)
  }, [formattedBody, searchTerm, isImage, isBinary])

  // Reset match index when search term changes
  useEffect(() => {
    setPlainMatchIndex(0)
  }, [searchTerm])

  // Helper: get CM match index from cursor position
  const getCmMatchInfo = useCallback((): MatchInfo => {
    const view = cmRef.current?.view
    if (!view || !searchTerm) return { current: 0, total: 0 }

    const doc = view.state.doc
    const cursor = new SearchCursor(doc, searchTerm.toLowerCase(), 0, doc.length, (x) => x.toLowerCase())
    let total = 0
    let current = 0
    const mainHead = view.state.selection.main.head

    while (!cursor.next().done) {
      if (cursor.value.from <= mainHead && mainHead <= cursor.value.to) {
        current = total
      }
      total++
    }
    return { current: total > 0 ? current : 0, total }
  }, [searchTerm])

  // Register nav handlers
  useEffect(() => {
    if (isImage || isBinary) {
      navRef.current = { next: () => {}, prev: () => {} }
      return () => { navRef.current = null }
    }

    if (isJson) {
      navRef.current = {
        next: () => {
          const view = cmRef.current?.view
          if (view) {
            findNext(view)
            setTimeout(() => onMatchInfo(getCmMatchInfo()), 10)
          }
        },
        prev: () => {
          const view = cmRef.current?.view
          if (view) {
            findPrevious(view)
            setTimeout(() => onMatchInfo(getCmMatchInfo()), 10)
          }
        },
      }
    } else {
      navRef.current = {
        next: () => {
          if (totalMatches === 0) return
          setPlainMatchIndex((prev) => (prev + 1) % totalMatches)
        },
        prev: () => {
          if (totalMatches === 0) return
          setPlainMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches)
        },
      }
    }

    return () => { navRef.current = null }
  }, [isJson, isImage, isBinary, totalMatches, navRef, onMatchInfo, getCmMatchInfo])

  // Report match info
  useEffect(() => {
    if (isImage || isBinary) {
      onMatchInfo({ current: 0, total: 0 })
    } else if (isJson) {
      onMatchInfo({ current: 0, total: totalMatches })
    } else {
      onMatchInfo({ current: totalMatches > 0 ? plainMatchIndex : 0, total: totalMatches })
    }
  }, [isJson, isImage, isBinary, totalMatches, plainMatchIndex, onMatchInfo])

  // Scroll to current match for plain text
  useEffect(() => {
    if (isJson || isImage || isBinary || !searchTerm || totalMatches === 0) return
    const el = containerRef.current?.querySelector(`[data-match-index="${plainMatchIndex}"]`)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [isJson, isImage, isBinary, searchTerm, plainMatchIndex, totalMatches])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(response.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (isBase64) {
      // Decode base64 to binary blob
      const byteChars = atob(response.body)
      const byteArray = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i)
      }
      const blob = new Blob([byteArray], { type: contentType || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `response.${getFileExtension(contentType)}`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const mimeType = isJson ? 'application/json' : 'text/plain'
      const blob = new Blob([response.body], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = isJson ? 'response.json' : 'response.txt'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // Image preview
  if (isImage) {
    const mime = getImageMimeType(contentType)
    const dataUrl = `data:${mime};base64,${response.body}`

    return (
      <div className="flex flex-col h-full">
        <div className="flex justify-end gap-2 p-2 border-b border-gray-200 dark:border-gray-700">
          <span className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500">
            <Image className="w-3 h-3" />
            {mime}
          </span>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <Download className="w-3 h-3" />
            {t('response.download')}
          </button>
        </div>
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[#1a1a2e]">
          <img
            src={dataUrl}
            alt="Response preview"
            className="max-w-full max-h-full object-contain rounded shadow-lg"
            style={{ imageRendering: 'auto' }}
          />
        </div>
      </div>
    )
  }

  // Other binary content (PDF, zip, etc.)
  if (isBinary) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex justify-end gap-2 p-2 border-b border-gray-200 dark:border-gray-700">
          <span className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500">
            {contentType || 'application/octet-stream'}
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-500 dark:text-gray-400">
          <FileDown className="w-12 h-12 text-gray-500" />
          <p className="text-sm">{t('response.binaryContent')}</p>
          <p className="text-xs text-gray-500">{formatSize(response.size)}</p>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white"
          >
            <Download className="w-4 h-4" />
            {t('response.download')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end gap-2 p-2 border-b border-gray-200 dark:border-gray-700">
        {isHtml && (
          <button
            onClick={() => setHtmlPreview(!htmlPreview)}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 text-xs transition-colors',
              htmlPreview
                ? 'text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            {htmlPreview ? <Code className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {htmlPreview ? t('response.rawView') : t('response.htmlPreview')}
          </button>
        )}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? t('response.copied') : t('response.copy')}
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <Download className="w-3 h-3" />
          {t('response.download')}
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto">
        {htmlPreview && isHtml ? (
          <iframe
            srcDoc={response.body}
            sandbox=""
            className="w-full h-full bg-white border-0"
            title="HTML Preview"
          />
        ) : isJson ? (
          <CodeMirror
            ref={cmRef}
            value={formattedBody}
            height="100%"
            theme="dark"
            extensions={[json(), searchExt]}
            editable={false}
            className="h-full"
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: false,
            }}
          />
        ) : (
          <pre className="p-4 text-sm font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            <HighlightedText text={response.body} search={searchTerm} currentMatchIndex={plainMatchIndex} />
          </pre>
        )}
      </div>
    </div>
  )
}

function SaveToVariableDropdown({
  value,
  onClose,
}: {
  value: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const { data: envVarsData } = useEnvironmentVariables(activeEnvironmentId)
  const setVariable = useSetEnvironmentVariable()
  const [newVarName, setNewVarName] = useState('')
  const [showNewInput, setShowNewInput] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const rawVars = Array.isArray(envVarsData) ? envVarsData : (envVarsData as unknown as { variables?: unknown[] })?.variables
  const variables = (rawVars as Array<{ key: string; teamValue?: string; localValue?: string }>) || []

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleSave = (key: string) => {
    if (!activeEnvironmentId || !key.trim()) return
    setVariable.mutate(
      { envId: activeEnvironmentId, key: key.trim(), data: { value, scope: 'global', category: 'work' } },
      {
        onSuccess: () => {
          setSaved(key)
          setTimeout(() => onClose(), 800)
        },
      }
    )
  }

  if (!activeEnvironmentId) {
    return (
      <div ref={dropdownRef} className="absolute right-0 top-full mt-1 z-50 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-3 min-w-[220px]">
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('response.noEnvironment')}</p>
      </div>
    )
  }

  return (
    <div ref={dropdownRef} className="absolute right-0 top-full mt-1 z-50 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl min-w-[240px] max-h-[280px] flex flex-col">
      <div className="px-3 py-2 border-b border-gray-300 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 font-medium">
        {t('response.saveToVariable')}
      </div>

      {variables.length > 0 && (
        <div className="flex-1 overflow-auto">
          {variables.map((v) => (
            <button
              key={v.key}
              onClick={() => handleSave(v.key)}
              className={clsx(
                'w-full text-left px-3 py-1.5 text-sm hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-between gap-2',
                saved === v.key && 'bg-green-900/30'
              )}
            >
              <span className="font-mono text-gray-700 dark:text-gray-300 truncate">{v.key}</span>
              {saved === v.key && <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-gray-300 dark:border-gray-600 p-2">
        {showNewInput ? (
          <div className="flex gap-1">
            <input
              type="text"
              value={newVarName}
              onChange={(e) => setNewVarName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newVarName.trim()) handleSave(newVarName) }}
              placeholder={t('response.newVarPlaceholder')}
              className="flex-1 px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded font-mono focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={() => { if (newVarName.trim()) handleSave(newVarName) }}
              disabled={!newVarName.trim()}
              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-white"
            >
              {t('common.save')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewInput(true)}
            className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-blue-400 hover:text-blue-300"
          >
            <Plus className="w-3 h-3" />
            {t('response.newVariable')}
          </button>
        )}
      </div>
    </div>
  )
}

function HeadersTab({
  response,
  t,
  searchTerm,
  navRef,
  onMatchInfo,
}: {
  response: HttpResponse
  t: (key: string) => string
  searchTerm: string
  navRef: React.MutableRefObject<SearchNavHandle | null>
  onMatchInfo: (info: MatchInfo) => void
}) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [currentRow, setCurrentRow] = useState(0)
  const tableRef = useRef<HTMLTableSectionElement>(null)

  const filteredHeaders = useMemo(() => {
    const entries = Object.entries(response.headers)
    if (!searchTerm) return entries
    const needle = searchTerm.toLowerCase()
    return entries.filter(
      ([key, value]) => key.toLowerCase().includes(needle) || value.toLowerCase().includes(needle)
    )
  }, [response.headers, searchTerm])

  // Reset when search or filtered results change
  useEffect(() => {
    setCurrentRow(0)
  }, [searchTerm])

  // Register nav handlers
  useEffect(() => {
    const total = filteredHeaders.length
    navRef.current = {
      next: () => {
        if (total === 0) return
        setCurrentRow((prev) => (prev + 1) % total)
      },
      prev: () => {
        if (total === 0) return
        setCurrentRow((prev) => (prev - 1 + total) % total)
      },
    }
    return () => { navRef.current = null }
  }, [filteredHeaders.length, navRef])

  // Report match info
  useEffect(() => {
    if (searchTerm) {
      onMatchInfo({ current: filteredHeaders.length > 0 ? currentRow : 0, total: filteredHeaders.length })
    } else {
      onMatchInfo({ current: 0, total: 0 })
    }
  }, [searchTerm, filteredHeaders.length, currentRow, onMatchInfo])

  // Scroll to current row
  useEffect(() => {
    if (!searchTerm || filteredHeaders.length === 0) return
    const row = tableRef.current?.children[currentRow] as HTMLElement | undefined
    if (row) {
      row.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [searchTerm, currentRow, filteredHeaders.length])

  return (
    <div className="p-4">
      {searchTerm && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {filteredHeaders.length}/{Object.keys(response.headers).length} {t('response.headersMatch')}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase">
            <th className="pb-2 font-medium">{t('response.headerName')}</th>
            <th className="pb-2 font-medium">{t('response.headerValue')}</th>
            <th className="pb-2 w-8"></th>
          </tr>
        </thead>
        <tbody ref={tableRef}>
          {filteredHeaders.map(([key, value], rowIdx) => (
            <tr
              key={key}
              className={clsx(
                'border-t border-gray-200/50 dark:border-gray-700/50 group transition-colors',
                searchTerm && rowIdx === currentRow && 'bg-blue-500/10'
              )}
            >
              <td className="py-2 pr-4 font-mono text-gray-500 dark:text-gray-400">
                <HighlightedText text={key} search={searchTerm} />
              </td>
              <td className="py-2 font-mono text-gray-700 dark:text-gray-300 break-all">
                <HighlightedText text={value} search={searchTerm} />
              </td>
              <td className="py-2 relative">
                <button
                  onClick={() => setOpenDropdown(openDropdown === key ? null : key)}
                  className="p-1 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title={t('response.saveToVariable')}
                >
                  <Variable className="w-3.5 h-3.5" />
                </button>
                {openDropdown === key && (
                  <SaveToVariableDropdown
                    value={value}
                    onClose={() => setOpenDropdown(null)}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TestsTab({ t }: { t: (key: string) => string }) {
  const scriptTests = useAppStore((s) => s.scriptTests)

  const passedCount = scriptTests.filter((test) => test.passed).length
  const failedCount = scriptTests.filter((test) => !test.passed).length

  return (
    <div className="p-4">
      {scriptTests.length === 0 ? (
        <p className="text-gray-500 text-sm">{t('tests.noTests')}</p>
      ) : (
        <>
          <div className="flex gap-4 mb-4 text-sm">
            <span className="text-green-400">{passedCount} {t('tests.passed')}</span>
            <span className={failedCount > 0 ? 'text-red-400' : 'text-gray-500'}>{failedCount} {t('tests.failed')}</span>
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
                <span className="text-gray-700 dark:text-gray-300">{test.name}</span>
                <span className="text-gray-500 text-xs">[{test.source}]</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ConsoleTab({ t }: { t: (key: string) => string }) {
  const scriptLogs = useAppStore((s) => s.scriptLogs)
  const scriptErrors = useAppStore((s) => s.scriptErrors)

  const allMessages = [
    ...scriptLogs.map((l) => ({ ...l, type: 'log' as const })),
    ...scriptErrors.map((e) => ({ ...e, type: 'error' as const })),
  ]

  return (
    <div className="p-4 font-mono text-sm">
      {allMessages.length === 0 ? (
        <p className="text-gray-500">{t('console.noOutput')}</p>
      ) : (
        <div className="space-y-1">
          {allMessages.map((msg, i) => (
            <div
              key={i}
              className={clsx(
                'flex gap-2',
                msg.type === 'error' ? 'text-red-400' : 'text-gray-700 dark:text-gray-300'
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

// --- Main Component ---

export function ResponseViewer() {
  const currentResponse = useAppStore((s) => s.currentResponse)
  const isLoading = useAppStore((s) => s.isLoading)
  const requestError = useAppStore((s) => s.requestError)
  const responseTab = useAppStore((s) => s.responseTab)
  const setResponseTab = useAppStore((s) => s.setResponseTab)
  const { t } = useTranslation()

  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [matchInfo, setMatchInfo] = useState<MatchInfo>({ current: 0, total: 0 })
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchNavRef = useRef<SearchNavHandle | null>(null)

  const handleMatchInfo = useCallback((info: MatchInfo) => {
    setMatchInfo(info)
  }, [])

  const handleNext = useCallback(() => {
    searchNavRef.current?.next()
  }, [])

  const handlePrev = useCallback(() => {
    searchNavRef.current?.prev()
  }, [])

  const toggleSearch = useCallback(() => {
    setShowSearch((prev) => {
      if (!prev) {
        setTimeout(() => searchInputRef.current?.focus(), 0)
      } else {
        setSearchTerm('')
        setMatchInfo({ current: 0, total: 0 })
      }
      return !prev
    })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && currentResponse) {
        e.preventDefault()
        if (!showSearch) {
          setShowSearch(true)
          setTimeout(() => searchInputRef.current?.focus(), 0)
        } else {
          searchInputRef.current?.focus()
          searchInputRef.current?.select()
        }
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false)
        setSearchTerm('')
        setMatchInfo({ current: 0, total: 0 })
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [currentResponse, showSearch])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        handlePrev()
      } else {
        handleNext()
      }
    }
  }, [handleNext, handlePrev])

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

  if (requestError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-red-400">{t('response.error')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{requestError}</p>
          <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg w-full">
            <p className="text-xs text-gray-500 mb-1">{t('response.errorDetails')}</p>
            <code className="text-xs text-gray-700 dark:text-gray-300 break-all">{requestError}</code>
          </div>
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
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100/50 dark:bg-gray-800/50">
        <StatusBadge response={currentResponse} />
        <button
          onClick={toggleSearch}
          className={clsx(
            'p-1.5 rounded transition-colors',
            showSearch
              ? 'text-blue-400 bg-blue-500/20'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
          )}
          title={t('response.search')}
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100/30 dark:bg-gray-800/30">
          <Search className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('response.searchPlaceholder')}
            className="flex-1 px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded font-mono focus:outline-none focus:border-blue-500"
            autoFocus
          />

          {/* Match counter + nav */}
          {searchTerm && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums min-w-[3rem] text-center">
                {matchInfo.total > 0 ? `${matchInfo.current + 1}/${matchInfo.total}` : t('response.noResults')}
              </span>
              <button
                onClick={handlePrev}
                disabled={matchInfo.total === 0}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                title={t('response.prevMatch')}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleNext}
                disabled={matchInfo.total === 0}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                title={t('response.nextMatch')}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={() => { setShowSearch(false); setSearchTerm(''); setMatchInfo({ current: 0, total: 0 }) }}
            className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setResponseTab(tab.id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
              responseTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {responseTab === 'body' && (
          <BodyTab
            response={currentResponse}
            t={t}
            searchTerm={searchTerm}
            navRef={searchNavRef}
            onMatchInfo={handleMatchInfo}
          />
        )}
        {responseTab === 'headers' && (
          <HeadersTab
            response={currentResponse}
            t={t}
            searchTerm={searchTerm}
            navRef={searchNavRef}
            onMatchInfo={handleMatchInfo}
          />
        )}
        {responseTab === 'tests' && <TestsTab t={t} />}
        {responseTab === 'console' && <ConsoleTab t={t} />}
      </div>
    </div>
  )
}
