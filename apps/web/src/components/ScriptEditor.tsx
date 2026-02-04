import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { clsx } from 'clsx'

interface ScriptEditorProps {
  preScript: string
  postScript: string
  onChange: (pre: string, post: string) => void
  onBlur?: () => void
}

export function ScriptEditor({ preScript, postScript, onChange, onBlur }: ScriptEditorProps) {
  const [activeScript, setActiveScript] = useState<'pre' | 'post'>('pre')

  const tabs = [
    { id: 'pre', label: 'Pre-request', description: 'Runs before the request is sent' },
    { id: 'post', label: 'Post-response', description: 'Runs after the response is received' },
  ] as const

  const currentScript = activeScript === 'pre' ? preScript : postScript
  const currentDescription = tabs.find((t) => t.id === activeScript)?.description

  const handleChange = (value: string) => {
    if (activeScript === 'pre') {
      onChange(value, postScript)
    } else {
      onChange(preScript, value)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveScript(tab.id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
              activeScript === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-3 border-b border-gray-700 bg-gray-800/50">
        <p className="text-sm text-gray-400">{currentDescription}</p>
        <details className="mt-2">
          <summary className="text-xs text-blue-400 cursor-pointer hover:underline">
            Available APIs
          </summary>
          <div className="mt-2 text-xs text-gray-400 font-mono space-y-1">
            <p className="font-sans font-medium text-gray-300 mt-2">Environment:</p>
            <p>env.get("key") - Read variable</p>
            <p>env.set("key", "value") - Set local override</p>
            <p>env.delete("key") - Delete local override</p>

            {activeScript === 'pre' ? (
              <>
                <p className="font-sans font-medium text-gray-300 mt-2">Request (mutable):</p>
                <p>request.url - Get/set URL</p>
                <p>request.method - Get/set method</p>
                <p>request.headers.get("key")</p>
                <p>request.headers.set("key", "value")</p>
                <p>request.body.text() / json()</p>
                <p>request.body.set("text") / setJSON(obj)</p>
                <p>request.skip() - Cancel request</p>
              </>
            ) : (
              <>
                <p className="font-sans font-medium text-gray-300 mt-2">Response (read-only):</p>
                <p>response.status - HTTP status code</p>
                <p>response.statusText</p>
                <p>response.headers - Headers object</p>
                <p>response.body.text() / json()</p>
                <p>response.time - Response time (ms)</p>
                <p>response.size - Response size (bytes)</p>

                <p className="font-sans font-medium text-gray-300 mt-2">Testing:</p>
                <p>test("name", () ={'>'} condition)</p>
              </>
            )}

            <p className="font-sans font-medium text-gray-300 mt-2">Console:</p>
            <p>console.log(...args)</p>
            <p>console.error(...args)</p>
          </div>
        </details>
      </div>

      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={currentScript}
          height="100%"
          theme="dark"
          onChange={handleChange}
          onBlur={onBlur}
          className="h-full"
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
          }}
        />
      </div>
    </div>
  )
}
