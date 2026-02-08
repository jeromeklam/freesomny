import { useResolvedRequest } from '../hooks/useApi'
import { clsx } from 'clsx'

interface ResolvedViewProps {
  requestId: string
}

interface ResolvedData {
  url: {
    final: string
    segments: Array<{
      raw: string
      resolved: string
      source: 'folder' | 'request'
      folderName?: string
    }>
  }
  auth: {
    type: string
    config: Record<string, unknown>
    source: { type: 'folder' | 'request'; folderName?: string }
    inheritChain: string[]
  }
  headers: Array<{
    key: string
    value: string
    source: string
    overrides: Array<{ value: string; source: string }>
  }>
  queryParams: Array<{
    key: string
    value: string
    source: string
    overrides: Array<{ value: string; source: string }>
  }>
  scripts: {
    pre: Array<{ source: string; script: string }>
    post: Array<{ source: string; script: string }>
  }
}

function SourceTag({ source }: { source: string }) {
  const isAuth = source.startsWith('auth:')
  return (
    <span className={clsx(
      'inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded',
      isAuth
        ? 'bg-blue-900/40 text-blue-400 border border-blue-700/50'
        : 'bg-gray-700 text-gray-300'
    )}>
      [{source}]
    </span>
  )
}

function OverrideChain({ overrides }: { overrides: Array<{ value: string; source: string }> }) {
  if (overrides.length === 0) return null

  return (
    <span className="text-xs text-gray-500 ml-2">
      {overrides.map((o, i) => (
        <span key={i}>
          <span className="line-through">{o.value}</span>
          <span className="text-gray-600"> [{o.source}]</span>
          {i < overrides.length - 1 && ' < '}
        </span>
      ))}
    </span>
  )
}

export function ResolvedView({ requestId }: ResolvedViewProps) {
  const { data, isLoading, error } = useResolvedRequest(requestId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Loading resolved view...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        <p>Failed to load resolved view</p>
      </div>
    )
  }

  const resolved = data as ResolvedData

  return (
    <div className="p-4 space-y-6 overflow-auto">
      {/* URL */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 uppercase mb-2">URL</h3>
        <div className="bg-gray-800 rounded p-3">
          <div className="font-mono text-sm text-green-400 mb-2">{resolved.url.final}</div>
          {resolved.url.segments.length > 0 && (
            <div className="border-t border-gray-700 pt-2 mt-2">
              <p className="text-xs text-gray-500 mb-1">Segments:</p>
              {resolved.url.segments.map((segment, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <code className="text-gray-300">{segment.raw}</code>
                  <SourceTag source={segment.folderName || segment.source} />
                  {segment.raw !== segment.resolved && (
                    <span className="text-gray-500">→ {segment.resolved}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Headers */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 uppercase mb-2">
          Headers ({resolved.headers.length} resolved)
        </h3>
        <div className="bg-gray-800 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-700">
                <th className="px-3 py-2 font-medium">Key</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Overrides</th>
              </tr>
            </thead>
            <tbody>
              {resolved.headers.map((header, i) => {
                const isAuthGenerated = header.source.startsWith('auth:')
                return (
                  <tr key={i} className={clsx(
                    'border-b border-gray-700/50 last:border-0',
                    isAuthGenerated && 'bg-blue-900/10'
                  )}>
                    <td className={clsx('px-3 py-2 font-mono', isAuthGenerated ? 'text-blue-400' : 'text-gray-300')}>
                      {header.key}
                    </td>
                    <td className={clsx('px-3 py-2 font-mono truncate max-w-xs', isAuthGenerated ? 'text-blue-400' : 'text-gray-300')}>
                      {header.value}
                    </td>
                    <td className="px-3 py-2">
                      <SourceTag source={header.source} />
                    </td>
                    <td className="px-3 py-2">
                      <OverrideChain overrides={header.overrides} />
                    </td>
                  </tr>
                )
              })}
              {resolved.headers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                    No headers
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Query Params */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 uppercase mb-2">
          Query Params ({resolved.queryParams.length} resolved)
        </h3>
        <div className="bg-gray-800 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-700">
                <th className="px-3 py-2 font-medium">Key</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Overrides</th>
              </tr>
            </thead>
            <tbody>
              {resolved.queryParams.map((param, i) => (
                <tr key={i} className="border-b border-gray-700/50 last:border-0">
                  <td className="px-3 py-2 font-mono text-gray-300">{param.key}</td>
                  <td className="px-3 py-2 font-mono text-gray-300">{param.value}</td>
                  <td className="px-3 py-2">
                    <SourceTag source={param.source} />
                  </td>
                  <td className="px-3 py-2">
                    <OverrideChain overrides={param.overrides} />
                  </td>
                </tr>
              ))}
              {resolved.queryParams.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                    No query parameters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Auth */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 uppercase mb-2">Auth</h3>
        <div className="bg-gray-800 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium">Type:</span>
            <span className="font-mono text-blue-400">{resolved.auth.type}</span>
            <SourceTag source={resolved.auth.source.folderName || resolved.auth.source.type} />
          </div>
          <div className="text-xs text-gray-500">
            Chain: {resolved.auth.inheritChain.join(' > ')}
          </div>
        </div>
      </section>

      {/* Scripts */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 uppercase mb-2">Scripts</h3>
        <div className="bg-gray-800 rounded p-3 space-y-4">
          <div>
            <p className="text-sm text-gray-400 mb-1">Pre-request (top-down):</p>
            {resolved.scripts.pre.length > 0 ? (
              <ol className="list-decimal list-inside text-sm">
                {resolved.scripts.pre.map((script, i) => (
                  <li key={i} className="text-gray-300">
                    <SourceTag source={script.source} />
                    <span className="ml-2 text-gray-500">
                      {script.script.substring(0, 50)}
                      {script.script.length > 50 && '...'}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-gray-500 text-sm">No pre-request scripts</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Post-response (bottom-up):</p>
            {resolved.scripts.post.length > 0 ? (
              <ol className="list-decimal list-inside text-sm">
                {resolved.scripts.post.map((script, i) => (
                  <li key={i} className="text-gray-300">
                    <SourceTag source={script.source} />
                    <span className="ml-2 text-gray-500">
                      {script.script.substring(0, 50)}
                      {script.script.length > 50 && '...'}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-gray-500 text-sm">No post-response scripts</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
