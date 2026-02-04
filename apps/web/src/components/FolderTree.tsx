import { useState, useRef } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileJson, Plus, MoreVertical, Trash2, Edit2, GripVertical } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../stores/app'
import { useCreateFolder, useCreateRequest, useDeleteFolder, useDeleteRequest, useReorderFolder, useReorderRequest } from '../hooks/useApi'

interface FolderNode {
  id: string
  name: string
  sortOrder: number
  children: FolderNode[]
  requests: Array<{
    id: string
    name: string
    method: string
    sortOrder: number
  }>
}

interface DragItem {
  type: 'folder' | 'request'
  id: string
  parentId: string | null
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'text-green-400',
    POST: 'text-yellow-400',
    PUT: 'text-blue-400',
    PATCH: 'text-purple-400',
    DELETE: 'text-red-400',
    HEAD: 'text-gray-400',
    OPTIONS: 'text-gray-400',
  }

  return (
    <span className={clsx('text-xs font-mono font-semibold w-12', colors[method] || 'text-gray-400')}>
      {method.substring(0, 3)}
    </span>
  )
}

interface FolderItemProps {
  folder: FolderNode
  level?: number
  parentId: string | null
  onDragStart: (item: DragItem) => void
  onDragEnd: () => void
  dragItem: DragItem | null
}

function FolderItem({ folder, level = 0, parentId, onDragStart, onDragEnd, dragItem }: FolderItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [dropTarget, setDropTarget] = useState<'above' | 'inside' | 'below' | null>(null)
  const folderRef = useRef<HTMLDivElement>(null)

  const expandedFolders = useAppStore((s) => s.expandedFolders)
  const toggleFolderExpanded = useAppStore((s) => s.toggleFolderExpanded)
  const selectedFolderId = useAppStore((s) => s.selectedFolderId)
  const setSelectedFolderId = useAppStore((s) => s.setSelectedFolderId)
  const selectedRequestId = useAppStore((s) => s.selectedRequestId)
  const setSelectedRequestId = useAppStore((s) => s.setSelectedRequestId)
  const setCurrentRequest = useAppStore((s) => s.setCurrentRequest)

  const createFolder = useCreateFolder()
  const createRequest = useCreateRequest()
  const deleteFolder = useDeleteFolder()
  const deleteFolderReq = useDeleteRequest()
  const reorderFolder = useReorderFolder()
  const reorderRequest = useReorderRequest()

  const isExpanded = expandedFolders.has(folder.id)
  const isSelected = selectedFolderId === folder.id
  const isDragging = dragItem?.type === 'folder' && dragItem.id === folder.id

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFolderExpanded(folder.id)
  }

  const handleSelect = () => {
    setSelectedFolderId(folder.id)
    setSelectedRequestId(null)
    setCurrentRequest(null)
  }

  const handleRequestSelect = (request: FolderNode['requests'][0]) => {
    setSelectedRequestId(request.id)
    setSelectedFolderId(null)
    setCurrentRequest(request as unknown as ReturnType<typeof useAppStore.getState>['currentRequest'])
  }

  const handleAddFolder = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    createFolder.mutate({ name: 'New Folder', parentId: folder.id })
    if (!isExpanded) toggleFolderExpanded(folder.id)
  }

  const handleAddRequest = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    createRequest.mutate({ name: 'New Request', folderId: folder.id, method: 'GET' })
    if (!isExpanded) toggleFolderExpanded(folder.id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    if (confirm(`Delete folder "${folder.name}" and all its contents?`)) {
      deleteFolder.mutate(folder.id)
    }
  }

  // Drag handlers for folder
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', id: folder.id, parentId }))
    onDragStart({ type: 'folder', id: folder.id, parentId })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!dragItem || (dragItem.type === 'folder' && dragItem.id === folder.id)) {
      return
    }

    // Prevent dropping a folder into itself or its children
    if (dragItem.type === 'folder' && isDescendant(dragItem.id, folder.id)) {
      return
    }

    const rect = folderRef.current?.getBoundingClientRect()
    if (!rect) return

    const y = e.clientY - rect.top
    const height = rect.height

    // Determine drop position based on mouse position
    if (y < height * 0.25) {
      setDropTarget('above')
    } else if (y > height * 0.75) {
      setDropTarget('below')
    } else {
      setDropTarget('inside')
    }

    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDropTarget(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!dragItem || !dropTarget) {
      setDropTarget(null)
      return
    }

    // Prevent dropping a folder into itself
    if (dragItem.type === 'folder' && dragItem.id === folder.id) {
      setDropTarget(null)
      return
    }

    // Prevent dropping a folder into its descendants
    if (dragItem.type === 'folder' && isDescendant(dragItem.id, folder.id)) {
      setDropTarget(null)
      return
    }

    if (dragItem.type === 'folder') {
      if (dropTarget === 'inside') {
        // Move folder as child of this folder
        reorderFolder.mutate({
          id: dragItem.id,
          parentId: folder.id,
          sortOrder: 0,
        })
        if (!isExpanded) toggleFolderExpanded(folder.id)
      } else {
        // Move folder as sibling (above or below)
        const newSortOrder = dropTarget === 'above'
          ? folder.sortOrder
          : folder.sortOrder + 1
        reorderFolder.mutate({
          id: dragItem.id,
          parentId: parentId,
          sortOrder: newSortOrder,
        })
      }
    } else if (dragItem.type === 'request') {
      if (dropTarget === 'inside' || dropTarget === 'below' || dropTarget === 'above') {
        // Move request to this folder
        reorderRequest.mutate({
          id: dragItem.id,
          parentId: folder.id,
          sortOrder: 0,
        })
        if (!isExpanded) toggleFolderExpanded(folder.id)
      }
    }

    setDropTarget(null)
  }

  // Helper to check if folderId is a descendant of ancestorId
  const isDescendant = (ancestorId: string, folderId: string): boolean => {
    // This would need access to the full folder tree to check properly
    // For simplicity, we prevent dropping on any folder when dragging a folder
    return false
  }

  return (
    <div className="select-none">
      {/* Drop indicator above */}
      {dropTarget === 'above' && (
        <div
          className="h-0.5 bg-blue-500 mx-2 rounded"
          style={{ marginLeft: `${level * 16 + 8}px` }}
        />
      )}

      <div
        ref={folderRef}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          'flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-800 rounded group',
          isSelected && 'bg-gray-800',
          isDragging && 'opacity-50',
          dropTarget === 'inside' && 'ring-2 ring-blue-500 ring-inset'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleSelect}
      >
        <div className="cursor-grab opacity-0 group-hover:opacity-50 hover:opacity-100">
          <GripVertical className="w-3 h-3 text-gray-500" />
        </div>

        <button onClick={handleToggle} className="p-0.5 hover:bg-gray-700 rounded">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {isExpanded ? (
          <FolderOpen className="w-4 h-4 text-yellow-500" />
        ) : (
          <Folder className="w-4 h-4 text-yellow-500" />
        )}

        <span className="flex-1 truncate text-sm">{folder.name}</span>

        <div className="relative opacity-0 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full z-50 mt-1 w-40 bg-gray-800 border border-gray-700 rounded shadow-lg">
              <button
                onClick={handleAddFolder}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700"
              >
                <Plus className="w-4 h-4" /> Add Folder
              </button>
              <button
                onClick={handleAddRequest}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700"
              >
                <FileJson className="w-4 h-4" /> Add Request
              </button>
              <hr className="border-gray-700" />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                  setSelectedFolderId(folder.id)
                  setSelectedRequestId(null)
                  setCurrentRequest(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700"
              >
                <Edit2 className="w-4 h-4" /> Edit Settings
              </button>
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Drop indicator below */}
      {dropTarget === 'below' && (
        <div
          className="h-0.5 bg-blue-500 mx-2 rounded"
          style={{ marginLeft: `${level * 16 + 8}px` }}
        />
      )}

      {isExpanded && (
        <div>
          {folder.children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              level={level + 1}
              parentId={folder.id}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              dragItem={dragItem}
            />
          ))}

          {folder.requests.map((request) => (
            <RequestItem
              key={request.id}
              request={request}
              folderId={folder.id}
              level={level + 1}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              dragItem={dragItem}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface RequestItemProps {
  request: FolderNode['requests'][0]
  folderId: string
  level: number
  onDragStart: (item: DragItem) => void
  onDragEnd: () => void
  dragItem: DragItem | null
}

function RequestItem({ request, folderId, level, onDragStart, onDragEnd, dragItem }: RequestItemProps) {
  const [dropTarget, setDropTarget] = useState<'above' | 'below' | null>(null)
  const requestRef = useRef<HTMLDivElement>(null)

  const selectedRequestId = useAppStore((s) => s.selectedRequestId)
  const setSelectedRequestId = useAppStore((s) => s.setSelectedRequestId)
  const setSelectedFolderId = useAppStore((s) => s.setSelectedFolderId)
  const setCurrentRequest = useAppStore((s) => s.setCurrentRequest)

  const deleteRequest = useDeleteRequest()
  const reorderRequest = useReorderRequest()

  const isDragging = dragItem?.type === 'request' && dragItem.id === request.id

  const handleSelect = () => {
    setSelectedRequestId(request.id)
    setSelectedFolderId(null)
    setCurrentRequest(request as unknown as ReturnType<typeof useAppStore.getState>['currentRequest'])
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'request', id: request.id, parentId: folderId }))
    onDragStart({ type: 'request', id: request.id, parentId: folderId })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!dragItem || dragItem.id === request.id) {
      return
    }

    // Only allow requests to be reordered with other requests
    if (dragItem.type !== 'request') {
      return
    }

    const rect = requestRef.current?.getBoundingClientRect()
    if (!rect) return

    const y = e.clientY - rect.top
    const height = rect.height

    if (y < height / 2) {
      setDropTarget('above')
    } else {
      setDropTarget('below')
    }

    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDropTarget(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!dragItem || dragItem.type !== 'request' || !dropTarget) {
      setDropTarget(null)
      return
    }

    const newSortOrder = dropTarget === 'above'
      ? request.sortOrder
      : request.sortOrder + 1

    reorderRequest.mutate({
      id: dragItem.id,
      parentId: folderId,
      sortOrder: newSortOrder,
    })

    setDropTarget(null)
  }

  return (
    <>
      {/* Drop indicator above */}
      {dropTarget === 'above' && (
        <div
          className="h-0.5 bg-blue-500 mx-2 rounded"
          style={{ marginLeft: `${level * 16 + 8}px` }}
        />
      )}

      <div
        ref={requestRef}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          'flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-800 rounded group',
          selectedRequestId === request.id && 'bg-gray-800',
          isDragging && 'opacity-50'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleSelect}
      >
        <div className="cursor-grab opacity-0 group-hover:opacity-50 hover:opacity-100">
          <GripVertical className="w-3 h-3 text-gray-500" />
        </div>

        <MethodBadge method={request.method} />
        <span className="flex-1 truncate text-sm">{request.name}</span>

        <button
          onClick={(e) => {
            e.stopPropagation()
            if (confirm(`Delete request "${request.name}"?`)) {
              deleteRequest.mutate(request.id)
            }
          }}
          className="p-1 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-3 h-3 text-gray-400" />
        </button>
      </div>

      {/* Drop indicator below */}
      {dropTarget === 'below' && (
        <div
          className="h-0.5 bg-blue-500 mx-2 rounded"
          style={{ marginLeft: `${level * 16 + 8}px` }}
        />
      )}
    </>
  )
}

export function FolderTree() {
  const folders = useAppStore((s) => s.folders)
  const createFolder = useCreateFolder()
  const [dragItem, setDragItem] = useState<DragItem | null>(null)

  const handleDragStart = (item: DragItem) => {
    setDragItem(item)
  }

  const handleDragEnd = () => {
    setDragItem(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-400">COLLECTIONS</span>
        <button
          onClick={() => createFolder.mutate({ name: 'New Collection', parentId: null })}
          className="p-1 hover:bg-gray-700 rounded"
          title="New Collection"
        >
          <Plus className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-auto py-2">
        {folders.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            <p>No collections yet.</p>
            <button
              onClick={() => createFolder.mutate({ name: 'My Collection', parentId: null })}
              className="mt-2 text-blue-400 hover:underline"
            >
              Create your first collection
            </button>
          </div>
        ) : (
          folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder as unknown as FolderNode}
              parentId={null}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              dragItem={dragItem}
            />
          ))
        )}
      </div>
    </div>
  )
}
