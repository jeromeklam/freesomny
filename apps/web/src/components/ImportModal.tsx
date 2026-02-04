import { useState, useRef } from 'react'
import { X, Upload, FileJson, Terminal, FileCode, Zap } from 'lucide-react'
import { clsx } from 'clsx'
import { useQueryClient } from '@tanstack/react-query'
import { importApi } from '../lib/api'

type ImportFormat = 'postman' | 'hoppscotch' | 'openapi' | 'curl'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [format, setFormat] = useState<ImportFormat>('postman')
  const [file, setFile] = useState<File | null>(null)
  const [curlCommand, setCurlCommand] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      setSuccess(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
      setError(null)
      setSuccess(null)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleImport = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (format === 'curl') {
        if (!curlCommand.trim()) {
          throw new Error('Please enter a cURL command')
        }
        await importApi.curl(curlCommand)
        setSuccess('cURL command imported successfully')
        setCurlCommand('')
      } else {
        if (!file) {
          throw new Error('Please select a file to import')
        }

        const content = await file.text()
        let parsed: unknown

        try {
          parsed = JSON.parse(content)
        } catch {
          if (format === 'openapi' && (content.startsWith('openapi:') || content.startsWith('swagger:'))) {
            parsed = content
          } else {
            throw new Error('Invalid JSON file')
          }
        }

        if (format === 'postman') {
          await importApi.postman(parsed)
          setSuccess('Postman collection imported successfully')
        } else if (format === 'hoppscotch') {
          await importApi.hoppscotch(parsed)
          setSuccess('Hoppscotch collection imported successfully')
        } else if (format === 'openapi') {
          await importApi.openapi(parsed)
          setSuccess('OpenAPI specification imported successfully')
        }

        setFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }

      queryClient.invalidateQueries({ queryKey: ['folders'] })
      queryClient.invalidateQueries({ queryKey: ['environments'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setCurlCommand('')
    setError(null)
    setSuccess(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Import Collection</h2>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Format selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Format</label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFormat('postman')
                  setError(null)
                  setSuccess(null)
                }}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded border',
                  format === 'postman'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'border-gray-600 text-gray-300 hover:border-gray-500'
                )}
              >
                <FileJson className="w-4 h-4" />
                Postman
              </button>
              <button
                onClick={() => {
                  setFormat('hoppscotch')
                  setError(null)
                  setSuccess(null)
                }}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded border',
                  format === 'hoppscotch'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'border-gray-600 text-gray-300 hover:border-gray-500'
                )}
              >
                <Zap className="w-4 h-4" />
                Hoppscotch
              </button>
              <button
                onClick={() => {
                  setFormat('openapi')
                  setError(null)
                  setSuccess(null)
                }}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded border',
                  format === 'openapi'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'border-gray-600 text-gray-300 hover:border-gray-500'
                )}
              >
                <FileCode className="w-4 h-4" />
                OpenAPI
              </button>
              <button
                onClick={() => {
                  setFormat('curl')
                  setError(null)
                  setSuccess(null)
                }}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded border',
                  format === 'curl'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'border-gray-600 text-gray-300 hover:border-gray-500'
                )}
              >
                <Terminal className="w-4 h-4" />
                cURL
              </button>
            </div>
          </div>

          {/* File upload or cURL input */}
          {format === 'curl' ? (
            <div>
              <label className="block text-sm text-gray-400 mb-2">cURL Command</label>
              <textarea
                value={curlCommand}
                onChange={(e) => setCurlCommand(e.target.value)}
                placeholder="curl -X GET https://api.example.com/users -H 'Authorization: Bearer token'"
                className="w-full h-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm font-mono resize-none focus:outline-none focus:border-blue-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {format === 'postman'
                  ? 'Postman Collection (JSON)'
                  : format === 'hoppscotch'
                    ? 'Hoppscotch Collection (JSON)'
                    : 'OpenAPI Specification (JSON/YAML)'}
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className={clsx(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  file
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/50'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.yaml,.yml"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <div className="text-green-400">
                    <FileJson className="w-8 h-8 mx-auto mb-2" />
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="text-gray-400">
                    <Upload className="w-8 h-8 mx-auto mb-2" />
                    <p>Drop file here or click to browse</p>
                    <p className="text-sm mt-1">
                      {format === 'postman'
                        ? 'Supports Postman v2.1 collections'
                        : format === 'hoppscotch'
                          ? 'Supports Hoppscotch collections'
                          : 'Supports OpenAPI 3.x'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="px-3 py-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="px-3 py-2 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-sm">
              {success}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isLoading || (format !== 'curl' && !file) || (format === 'curl' && !curlCommand.trim())}
            className={clsx(
              'px-4 py-2 rounded font-medium',
              isLoading || (format !== 'curl' && !file) || (format === 'curl' && !curlCommand.trim())
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            )}
          >
            {isLoading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
