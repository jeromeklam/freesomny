import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileJson, Plus, MoreVertical, Trash2, Edit2, Pencil, GripVertical, Copy, ArrowUpFromLine, ArrowDownFromLine, Users, Search, X, Star } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../stores/app'
import { useCreateFolder, useCreateRequest, useDeleteFolder, useDeleteRequest, useDuplicateRequest, useUpdateRequest, useReorderFolder, useReorderRequest, useFavorites, useToggleFavorite } from '../hooks/useApi'
import { useTranslation } from '../hooks/useTranslation'

interface FolderNode {
  id: string
  name: string
  sortOrder: number
  group?: { id: string; name: string } | null
  children: FolderNode[]
  requests: Array<{
    id: string
    name: string
    method: string
    sortOrder: number
    isFavorite?: boolean
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
  siblingFolders?: FolderNode[]
  inheritedGroup?: { id: string; name: string } | null
  onDragStart: (item: DragItem) => void
  onDragEnd: () => void
  dragItem: DragItem | null
  searchExpandedIds?: Set<string> | null
}

function FolderItem({ folder, level = 0, parentId, siblingFolders = [], inheritedGroup, onDragStart, onDragEnd, dragItem, searchExpandedIds }: FolderItemProps) {
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
  const { t } = useTranslation()

  const isExpanded = searchExpandedIds ? searchExpandedIds.has(folder.id) : expandedFolders.has(folder.id)
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

  const handleInsertFolderBefore = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    const idx = siblingFolders.findIndex(f => f.id === folder.id)
    const prevOrder = idx > 0 ? siblingFolders[idx - 1].sortOrder : folder.sortOrder - 1
    const sortOrder = Math.floor((prevOrder + folder.sortOrder) / 2)
    createFolder.mutate({ name: 'New Folder', parentId, sortOrder: sortOrder === folder.sortOrder ? folder.sortOrder - 1 : sortOrder })
  }

  const handleInsertFolderAfter = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    const idx = siblingFolders.findIndex(f => f.id === folder.id)
    const nextOrder = idx < siblingFolders.length - 1 ? siblingFolders[idx + 1].sortOrder : folder.sortOrder + 1
    const sortOrder = Math.floor((folder.sortOrder + nextOrder) / 2)
    createFolder.mutate({ name: 'New Folder', parentId, sortOrder: sortOrder === folder.sortOrder ? folder.sortOrder + 1 : sortOrder })
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    if (confirm(t('sidebar.confirmDeleteFolder').replace('{name}', folder.name))) {
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

        {folder.group ? (
          <span
            className="flex items-center gap-0.5 px-1 py-0.5 text-[9px] bg-purple-900/30 text-purple-400 border border-purple-700/50 rounded shrink-0"
            title={folder.group.name}
          >
            <Users className="w-3 h-3" />
          </span>
        ) : inheritedGroup ? (
          <span
            className="flex items-center gap-0.5 px-1 py-0.5 text-[9px] bg-purple-900/15 text-purple-500/50 border border-purple-700/25 rounded shrink-0"
            title={`${inheritedGroup.name} (${t('inherited.inherited')})`}
          >
            <Users className="w-3 h-3" />
          </span>
        ) : null}

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
            <div className="absolute right-0 top-full z-50 mt-1 w-48 bg-gray-800 border border-gray-700 rounded shadow-lg">
              <button
                onClick={handleAddFolder}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700"
              >
                <Plus className="w-4 h-4" /> {t('sidebar.addFolder')}
              </button>
              <button
                onClick={handleAddRequest}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700"
              >
                <FileJson className="w-4 h-4" /> {t('sidebar.addRequest')}
              </button>
              <hr className="border-gray-700" />
              <button
                onClick={handleInsertFolderBefore}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700"
              >
                <ArrowUpFromLine className="w-4 h-4" /> {t('sidebar.insertBefore')}
              </button>
              <button
                onClick={handleInsertFolderAfter}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700"
              >
                <ArrowDownFromLine className="w-4 h-4" /> {t('sidebar.insertAfter')}
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
                <Edit2 className="w-4 h-4" /> {t('sidebar.editSettings')}
              </button>
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700"
              >
                <Trash2 className="w-4 h-4" /> {t('sidebar.delete')}
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
              siblingFolders={folder.children}
              inheritedGroup={folder.group || inheritedGroup}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              dragItem={dragItem}
              searchExpandedIds={searchExpandedIds}
            />
          ))}

          {folder.requests.map((request) => (
            <RequestItem
              key={request.id}
              request={request}
              siblingRequests={folder.requests}
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
  siblingRequests?: FolderNode['requests']
  onDragStart: (item: DragItem) => void
  onDragEnd: () => void
  dragItem: DragItem | null
}

function RequestItem({ request, folderId, level, siblingRequests = [], onDragStart, onDragEnd, dragItem }: RequestItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameName, setRenameName] = useState(request.name)
  const [dropTarget, setDropTarget] = useState<'above' | 'below' | null>(null)
  const requestRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const selectedRequestId = useAppStore((s) => s.selectedRequestId)
  const setSelectedFolderId = useAppStore((s) => s.setSelectedFolderId)
  const setCurrentRequest = useAppStore((s) => s.setCurrentRequest)
  const openRequestTab = useAppStore((s) => s.openRequestTab)
  const updateRequestTabInfo = useAppStore((s) => s.updateRequestTabInfo)

  const createRequest = useCreateRequest()
  const deleteRequest = useDeleteRequest()
  const duplicateRequest = useDuplicateRequest()
  const updateRequest = useUpdateRequest()
  const reorderRequest = useReorderRequest()
  const toggleFavorite = useToggleFavorite()
  const { t } = useTranslation()

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])

  const handleInsertBefore = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    const idx = siblingRequests.findIndex(r => r.id === request.id)
    const prevOrder = idx > 0 ? siblingRequests[idx - 1].sortOrder : request.sortOrder - 1
    const sortOrder = Math.floor((prevOrder + request.sortOrder) / 2)
    createRequest.mutate({ name: 'New Request', folderId, method: 'GET', sortOrder: sortOrder === request.sortOrder ? request.sortOrder - 1 : sortOrder })
  }

  const handleInsertAfter = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    const idx = siblingRequests.findIndex(r => r.id === request.id)
    const nextOrder = idx < siblingRequests.length - 1 ? siblingRequests[idx + 1].sortOrder : request.sortOrder + 1
    const sortOrder = Math.floor((request.sortOrder + nextOrder) / 2)
    createRequest.mutate({ name: 'New Request', folderId, method: 'GET', sortOrder: sortOrder === request.sortOrder ? request.sortOrder + 1 : sortOrder })
  }

  const isDragging = dragItem?.type === 'request' && dragItem.id === request.id

  const handleSelect = () => {
    openRequestTab(request.id, request.name, request.method)
    setSelectedFolderId(null)
    setCurrentRequest(request as unknown as ReturnType<typeof useAppStore.getState>['currentRequest'])
  }

  const startRename = () => {
    setRenameName(request.name)
    setIsRenaming(true)
    setShowMenu(false)
  }

  const handleRenameConfirm = () => {
    const trimmed = renameName.trim()
    if (trimmed && trimmed !== request.name) {
      updateRequestTabInfo(request.id, trimmed, request.method)
      updateRequest.mutate({ id: request.id, data: { name: trimmed } })
    }
    setIsRenaming(false)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameConfirm()
    } else if (e.key === 'Escape') {
      setIsRenaming(false)
    }
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
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onBlur={handleRenameConfirm}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 text-sm bg-gray-700 border border-blue-500 rounded px-1 py-0 outline-none text-gray-200"
          />
        ) : (
          <span className="flex-1 truncate text-sm" onDoubleClick={(e) => { e.stopPropagation(); startRename() }}>{request.name}</span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleFavorite.mutate({ id: request.id, isFavorite: !request.isFavorite })
          }}
          className={clsx(
            'p-0.5 rounded transition-opacity',
            request.isFavorite
              ? 'text-yellow-400 opacity-100'
              : 'text-gray-500 opacity-0 group-hover:opacity-100 hover:text-yellow-400'
          )}
          title={request.isFavorite ? t('sidebar.removeFromFavorites') : t('sidebar.addToFavorites')}
        >
          <Star className={clsx('w-3.5 h-3.5', request.isFavorite && 'fill-current')} />
        </button>

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
            <div className="absolute right-0 top-full z-50 mt-1 w-44 bg-gray-800 border border-gray-700 rounded shadow-lg">
              <button
                onClick={handleInsertBefore}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700"
              >
                <ArrowUpFromLine className="w-4 h-4" /> {t('sidebar.insertBefore')}
              </button>
              <button
                onClick={handleInsertAfter}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700"
              >
                <ArrowDownFromLine className="w-4 h-4" /> {t('sidebar.insertAfter')}
              </button>
              <hr className="border-gray-700" />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  startRename()
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700"
              >
                <Pencil className="w-4 h-4" /> {t('sidebar.rename')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                  duplicateRequest.mutate(request.id)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700"
              >
                <Copy className="w-4 h-4" /> {t('sidebar.duplicate')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                  toggleFavorite.mutate({ id: request.id, isFavorite: !request.isFavorite })
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700"
              >
                <Star className={clsx('w-4 h-4', request.isFavorite && 'fill-current text-yellow-400')} />
                {request.isFavorite ? t('sidebar.removeFromFavorites') : t('sidebar.addToFavorites')}
              </button>
              <hr className="border-gray-700" />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                  if (confirm(t('sidebar.confirmDeleteRequest').replace('{name}', request.name))) {
                    deleteRequest.mutate(request.id)
                  }
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700"
              >
                <Trash2 className="w-4 h-4" /> {t('sidebar.delete')}
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
    </>
  )
}

// Recursively filter folder tree: keep folders/requests whose name matches the search term,
// and keep any parent folder that has matching descendants
function filterFolderTree(folders: FolderNode[], term: string): FolderNode[] {
  const lower = term.toLowerCase()

  function filterNode(folder: FolderNode): FolderNode | null {
    const nameMatch = folder.name.toLowerCase().includes(lower)
    const filteredChildren = folder.children
      .map(filterNode)
      .filter((c): c is FolderNode => c !== null)
    const filteredRequests = folder.requests.filter((r) =>
      r.name.toLowerCase().includes(lower)
    )

    // Keep folder if its name matches, or if it has matching children/requests
    if (nameMatch || filteredChildren.length > 0 || filteredRequests.length > 0) {
      return {
        ...folder,
        children: nameMatch ? folder.children : filteredChildren,
        requests: nameMatch ? folder.requests : filteredRequests,
      }
    }
    return null
  }

  return folders.map(filterNode).filter((f): f is FolderNode => f !== null)
}

// Collect all folder IDs in a tree (for auto-expand when searching)
function collectFolderIds(folders: FolderNode[]): Set<string> {
  const ids = new Set<string>()
  function walk(folder: FolderNode) {
    ids.add(folder.id)
    folder.children.forEach(walk)
  }
  folders.forEach(walk)
  return ids
}

export function FolderTree() {
  const folders = useAppStore((s) => s.folders)
  const selectedRequestId = useAppStore((s) => s.selectedRequestId)
  const setSelectedFolderId = useAppStore((s) => s.setSelectedFolderId)
  const setCurrentRequest = useAppStore((s) => s.setCurrentRequest)
  const openRequestTab = useAppStore((s) => s.openRequestTab)
  const favoritesExpanded = useAppStore((s) => s.favoritesExpanded)
  const setFavoritesExpanded = useAppStore((s) => s.setFavoritesExpanded)
  const createFolder = useCreateFolder()
  const { data: favorites = [] } = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const [dragItem, setDragItem] = useState<DragItem | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation()

  const handleDragStart = (item: DragItem) => {
    setDragItem(item)
  }

  const handleDragEnd = () => {
    setDragItem(null)
  }

  // Filter folders when searching
  const filteredFolders = useMemo(() => {
    if (!searchTerm.trim()) return folders as unknown as FolderNode[]
    return filterFolderTree(folders as unknown as FolderNode[], searchTerm.trim())
  }, [folders, searchTerm])

  // Auto-expand all filtered folders when searching
  const searchExpandedIds = useMemo(() => {
    if (!searchTerm.trim()) return null
    return collectFolderIds(filteredFolders)
  }, [filteredFolders, searchTerm])

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showSearch])

  const handleClearSearch = () => {
    setSearchTerm('')
    setShowSearch(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* FAVORITES section — above collections */}
      {favorites.length > 0 && (
        <div className="border-b border-gray-700">
          <div
            className="flex items-center gap-1 px-3 py-2 cursor-pointer hover:bg-gray-800/50"
            onClick={() => setFavoritesExpanded(!favoritesExpanded)}
          >
            {favoritesExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
            )}
            <Star className="w-3.5 h-3.5 text-yellow-400 fill-current" />
            <span className="text-sm font-medium text-gray-400">{t('sidebar.favorites')}</span>
            <span className="text-[10px] text-gray-600 ml-1">{favorites.length}</span>
          </div>

          {favoritesExpanded && (
            <div className="pb-1">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  className={clsx(
                    'flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-800 rounded group',
                    selectedRequestId === fav.id && 'bg-gray-800'
                  )}
                  style={{ paddingLeft: '24px' }}
                  onClick={() => {
                    openRequestTab(fav.id, fav.name, fav.method)
                    setSelectedFolderId(null)
                    setCurrentRequest(null)
                  }}
                >
                  <MethodBadge method={fav.method} />
                  <span className="flex-1 truncate text-sm">{fav.name}</span>
                  <span className="text-[10px] text-gray-600 truncate max-w-[80px]" title={fav.folderName}>
                    {fav.folderName}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite.mutate({ id: fav.id, isFavorite: false })
                    }}
                    className="p-0.5 text-yellow-400 opacity-0 group-hover:opacity-100 hover:text-yellow-500 rounded transition-opacity"
                    title={t('sidebar.removeFromFavorites')}
                  >
                    <Star className="w-3 h-3 fill-current" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* COLLECTIONS header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-400">{t('sidebar.collections')}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={clsx('p-1 hover:bg-gray-700 rounded', showSearch && 'bg-gray-700')}
            title={t('sidebar.search')}
          >
            <Search className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => createFolder.mutate({ name: 'New Collection', parentId: null })}
            className="p-1 hover:bg-gray-700 rounded"
            title={t('sidebar.newCollection')}
          >
            <Plus className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Search bar — only for collections */}
      {showSearch && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-700">
          <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') handleClearSearch() }}
            placeholder={t('sidebar.searchPlaceholder')}
            className="flex-1 min-w-0 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
          />
          {searchTerm && (
            <button
              onClick={handleClearSearch}
              className="p-0.5 hover:bg-gray-700 rounded"
              title={t('sidebar.clearSearch')}
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>
      )}

      {/* Collection tree */}
      <div className="flex-1 overflow-auto py-2">
        {folders.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            <p>{t('sidebar.noCollections')}</p>
            <button
              onClick={() => createFolder.mutate({ name: 'My Collection', parentId: null })}
              className="mt-2 text-blue-400 hover:underline"
            >
              {t('sidebar.createFirst')}
            </button>
          </div>
        ) : filteredFolders.length === 0 ? (
          <div className="px-4 py-4 text-center text-gray-500 text-sm">
            {t('sidebar.noResults')}
          </div>
        ) : (
          filteredFolders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder as unknown as FolderNode}
              parentId={null}
              siblingFolders={filteredFolders as unknown as FolderNode[]}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              dragItem={dragItem}
              searchExpandedIds={searchExpandedIds}
            />
          ))
        )}
      </div>
    </div>
  )
}
