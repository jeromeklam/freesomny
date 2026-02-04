const API_BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  }

  // Only set Content-Type to application/json if there's a body
  if (options?.body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error)
  }

  return data.data as T
}

// Folders
export const foldersApi = {
  list: () => request<unknown[]>('/folders'),
  get: (id: string) => request<unknown>(`/folders/${id}`),
  create: (data: unknown) =>
    request<unknown>('/folders', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: unknown) =>
    request<unknown>(`/folders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/folders/${id}`, { method: 'DELETE' }),
  reorder: (id: string, data: { parentId: string | null; sortOrder: number }) =>
    request<unknown>(`/folders/${id}/reorder`, { method: 'PATCH', body: JSON.stringify(data) }),
  getResolvedSettings: (id: string) => request<unknown>(`/folders/${id}/resolved-settings`),
}

// Requests
export const requestsApi = {
  get: (id: string) => request<unknown>(`/requests/${id}`),
  create: (data: unknown) =>
    request<unknown>('/requests', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: unknown) =>
    request<unknown>(`/requests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/requests/${id}`, { method: 'DELETE' }),
  reorder: (id: string, data: { parentId: string; sortOrder: number }) =>
    request<unknown>(`/requests/${id}/reorder`, { method: 'PATCH', body: JSON.stringify(data) }),
  getResolved: (id: string, environmentId?: string) =>
    request<unknown>(`/requests/${id}/resolved${environmentId ? `?environmentId=${environmentId}` : ''}`),
  send: (id: string, environmentId?: string) =>
    request<unknown>(`/requests/${id}/send${environmentId ? `?environmentId=${environmentId}` : ''}`, {
      method: 'POST',
    }),
}

// Ad-hoc send
export const sendApi = {
  send: (data: unknown, environmentId?: string) =>
    request<unknown>(`/send${environmentId ? `?environmentId=${environmentId}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// Environments
export const environmentsApi = {
  list: () => request<unknown[]>('/environments'),
  get: (id: string) => request<unknown>(`/environments/${id}`),
  create: (data: unknown) =>
    request<unknown>('/environments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: unknown) =>
    request<unknown>(`/environments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/environments/${id}`, { method: 'DELETE' }),
  activate: (id: string) =>
    request<unknown>(`/environments/${id}/activate`, { method: 'PUT' }),
  getVariables: (id: string) => request<unknown[]>(`/environments/${id}/variables`),
  setVariable: (id: string, key: string, data: unknown) =>
    request<unknown>(`/environments/${id}/variables/${key}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteVariable: (id: string, key: string) =>
    request<{ success: boolean }>(`/environments/${id}/variables/${key}`, { method: 'DELETE' }),
  setOverride: (id: string, key: string, data: unknown) =>
    request<unknown>(`/environments/${id}/overrides/${key}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteOverride: (id: string, key: string) =>
    request<{ success: boolean }>(`/environments/${id}/overrides/${key}`, { method: 'DELETE' }),
  resetAllOverrides: (id: string) =>
    request<{ success: boolean; count: number }>(`/environments/${id}/overrides`, { method: 'DELETE' }),
}

// History
export const historyApi = {
  list: (params?: { limit?: number; offset?: number; search?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.offset) searchParams.set('offset', params.offset.toString())
    if (params?.search) searchParams.set('search', params.search)
    const query = searchParams.toString()
    return request<{ entries: unknown[]; total: number }>(`/history${query ? `?${query}` : ''}`)
  },
  get: (id: string) => request<unknown>(`/history/${id}`),
  delete: (id: string) => request<{ success: boolean }>(`/history/${id}`, { method: 'DELETE' }),
  clear: () => request<{ success: boolean; count: number }>('/history', { method: 'DELETE' }),
}

// Settings
export const settingsApi = {
  get: () => request<unknown>('/settings'),
  update: (data: unknown) =>
    request<unknown>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
}

// Import
export const importApi = {
  postman: (collection: unknown) =>
    request<{ success: boolean; folderId: string }>('/import/postman', {
      method: 'POST',
      body: JSON.stringify({ collection }),
    }),
  hoppscotch: (collection: unknown) =>
    request<{ success: boolean; folderId: string }>('/import/hoppscotch', {
      method: 'POST',
      body: JSON.stringify({ collection }),
    }),
  curl: (curl: string, folderId?: string) =>
    request<{ success: boolean; requestId: string; folderId: string }>('/import/curl', {
      method: 'POST',
      body: JSON.stringify({ curl, folderId }),
    }),
  openapi: (spec: unknown) =>
    request<{ success: boolean; folderIds: string[]; environmentIds: string[] }>('/import/openapi', {
      method: 'POST',
      body: JSON.stringify({ spec }),
    }),
}

// Export
export const exportApi = {
  openapi: (folderId: string) => request<unknown>(`/export/openapi/${folderId}`),
  curl: (requestId: string) => request<{ curl: string }>(`/export/curl/${requestId}`),
}
