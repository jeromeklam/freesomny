import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { clsx } from 'clsx'
import { BODY_TYPES } from '@api-client/shared'

interface BodyEditorProps {
  bodyType: string
  body: string
  onChange: (type: string, body: string) => void
  onBlur?: () => void
}

export function BodyEditor({ bodyType, body, onChange, onBlur }: BodyEditorProps) {
  const handleTypeChange = (type: string) => {
    onChange(type, body)
    onBlur?.()
  }

  const handleBodyChange = (value: string) => {
    onChange(bodyType, value)
  }

  const formatJson = () => {
    try {
      const formatted = JSON.stringify(JSON.parse(body), null, 2)
      onChange(bodyType, formatted)
      onBlur?.()
    } catch {
      // Invalid JSON, don't format
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 p-3 border-b border-gray-700">
        {Object.entries(BODY_TYPES).map(([value, { label }]) => (
          <label key={value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="bodyType"
              value={value}
              checked={bodyType === value}
              onChange={() => handleTypeChange(value)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600"
            />
            <span className={clsx('text-sm', bodyType === value ? 'text-white' : 'text-gray-400')}>
              {label}
            </span>
          </label>
        ))}

        {bodyType === 'json' && (
          <button
            onClick={formatJson}
            className="ml-auto px-3 py-1 text-xs text-gray-400 hover:text-white border border-gray-600 rounded hover:border-gray-500"
          >
            Format
          </button>
        )}
      </div>

      {bodyType === 'none' ? (
        <div className="flex items-center justify-center flex-1 text-gray-500">
          <p>This request does not have a body</p>
        </div>
      ) : bodyType === 'json' ? (
        <div className="flex-1 overflow-auto">
          <CodeMirror
            value={body}
            height="100%"
            theme="dark"
            extensions={[json()]}
            onChange={handleBodyChange}
            onBlur={onBlur}
            className="h-full"
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
            }}
          />
        </div>
      ) : (
        <div className="flex-1 p-3">
          <textarea
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            onBlur={onBlur}
            placeholder={
              bodyType === 'raw'
                ? 'Enter raw body content...'
                : bodyType === 'urlencoded'
                ? 'key1=value1&key2=value2'
                : 'Enter body content...'
            }
            className="w-full h-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono resize-none focus:outline-none focus:border-blue-500"
          />
        </div>
      )}
    </div>
  )
}
