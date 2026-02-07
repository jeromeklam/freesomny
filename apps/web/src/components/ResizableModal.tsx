import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { clsx } from 'clsx'

interface ResizableModalProps {
  children: ReactNode
  storageKey: string
  defaultWidth: number
  defaultHeight: number
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  onClose?: () => void
  className?: string
}

function loadSize(key: string, defaultW: number, defaultH: number): { width: number; height: number } {
  try {
    const raw = localStorage.getItem(`modal-size:${key}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
        return { width: parsed.width, height: parsed.height }
      }
    }
  } catch {
    // ignore
  }
  return { width: defaultW, height: defaultH }
}

function saveSize(key: string, width: number, height: number) {
  try {
    localStorage.setItem(`modal-size:${key}`, JSON.stringify({ width, height }))
  } catch {
    // ignore
  }
}

export function ResizableModal({
  children,
  storageKey,
  defaultWidth,
  defaultHeight,
  minWidth = 320,
  minHeight = 200,
  maxWidth,
  maxHeight,
  onClose,
  className,
}: ResizableModalProps) {
  const [size, setSize] = useState(() => loadSize(storageKey, defaultWidth, defaultHeight))
  const dragging = useRef(false)
  const didDrag = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const startSize = useRef({ width: 0, height: 0 })

  const effectiveMaxWidth = maxWidth ?? window.innerWidth - 40
  const effectiveMaxHeight = maxHeight ?? window.innerHeight - 40

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragging.current = true
    didDrag.current = false
    startPos.current = { x: e.clientX, y: e.clientY }
    startSize.current = { ...size }
    document.body.style.cursor = 'nwse-resize'
    document.body.style.userSelect = 'none'
  }, [size])

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragging.current) return
      didDrag.current = true
      const dx = e.clientX - startPos.current.x
      const dy = e.clientY - startPos.current.y

      setSize({
        width: Math.min(Math.max(startSize.current.width + dx, minWidth), effectiveMaxWidth),
        height: Math.min(Math.max(startSize.current.height + dy, minHeight), effectiveMaxHeight),
      })
    }

    function handleMouseUp() {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [minWidth, minHeight, effectiveMaxWidth, effectiveMaxHeight])

  // Persist size to localStorage on change (debounced via the drag end)
  const prevSize = useRef(size)
  useEffect(() => {
    if (prevSize.current.width !== size.width || prevSize.current.height !== size.height) {
      prevSize.current = size
      saveSize(storageKey, size.width, size.height)
    }
  }, [size, storageKey])

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    // Don't close if we just finished dragging
    if (didDrag.current) {
      didDrag.current = false
      return
    }
    if (e.target === e.currentTarget && onClose) {
      onClose()
    }
  }, [onClose])

  // Also block overlay mousedown during drag to prevent click-outside
  const handleOverlayMouseDown = useCallback((e: React.MouseEvent) => {
    if (dragging.current) {
      e.stopPropagation()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleOverlayClick}
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        className={clsx(
          'relative bg-gray-900 border border-gray-700 rounded-lg shadow-xl flex flex-col overflow-hidden',
          className
        )}
        style={{
          width: size.width,
          height: size.height,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-10"
          title="Resize"
        >
          <svg
            className="w-4 h-4 m-0.5 text-gray-600 hover:text-gray-400 transition-colors"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14ZM14 6H12V4H14V6ZM10 10H8V8H10V10ZM6 14H4V12H6V14Z" />
          </svg>
        </div>
      </div>
    </div>
  )
}
