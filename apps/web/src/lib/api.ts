const API_BASE = '/api'

// Token storage
let authToken: string | null = localStorage.getItem('auth_token')

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) {
    localStorage.setItem('auth_token', token)
  } else {
    localStorage.removeItem('auth_token')
  }
}

export function getAuthToken(): string | null {
  return authToken
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  }

  // Only set Content-Type to application/json if there's a body
  if (options?.body) {
    headers['Content-Type'] = 'application/json'
  }

  // Add auth token if available
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
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
  getInherited: (id: string) => request<unknown>(`/folders/${id}/inherited`),
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
  duplicate: (id: string) =>
    request<unknown>(`/requests/${id}/duplicate`, { method: 'POST' }),
  reorder: (id: string, data: { parentId: string; sortOrder: number }) =>
    request<unknown>(`/requests/${id}/reorder`, { method: 'PATCH', body: JSON.stringify(data) }),
  getResolved: (id: string, environmentId?: string) =>
    request<unknown>(`/requests/${id}/resolved${environmentId ? `?environmentId=${environmentId}` : ''}`),
  getInherited: (id: string) =>
    request<unknown>(`/requests/${id}/inherited`),
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
  reorderVariables: (id: string, keys: string[]) =>
    request<{ success: boolean }>(`/environments/${id}/variables/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ keys }),
    }),
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

// Auth
export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export interface AuthStatus {
  authRequired: boolean
  setupRequired: boolean
}

export const authApi = {
  status: () => request<AuthStatus>('/auth/status'),
  register: (data: { email: string; password: string; name: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request<AuthUser>('/auth/me'),
  updateProfile: (data: { name?: string; password?: string; currentPassword?: string }) =>
    request<AuthUser>('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  forgotPassword: (email: string) =>
    request<{ success: boolean }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ success: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
}

// Admin
export interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  createdAt: string
  _count: { folders: number; groupMemberships: number; environments?: number }
  groupMemberships?: { group: { id: string; name: string }; role: string }[]
}

export interface AdminGroup {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  _count: { members: number; folders: number; environments: number }
  members?: { id: string; role: string; user: { id: string; email: string; name: string } }[]
}

export interface AuditEntry {
  id: string
  action: string
  userId: string | null
  targetId: string | null
  details: string
  createdAt: string
}

export interface AdminStats {
  users: number
  groups: number
  collections: number
  requests: number
  environments: number
}

export const adminApi = {
  // Stats
  getStats: () => request<AdminStats>('/admin/stats'),
  getSmtpStatus: () => request<{ configured: boolean }>('/admin/smtp-status'),

  // Users
  getUsers: () => request<AdminUser[]>('/admin/users'),
  getUser: (id: string) => request<AdminUser>(`/admin/users/${id}`),
  updateUser: (id: string, data: { role?: string; isActive?: boolean; name?: string }) =>
    request<AdminUser>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    request<{ success: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),
  resetUserPassword: (id: string) =>
    request<{ success: boolean; consoleOnly?: boolean }>(`/admin/users/${id}/reset-password`, {
      method: 'POST',
    }),

  // Groups
  getGroups: () => request<AdminGroup[]>('/admin/groups'),
  getGroup: (id: string) => request<AdminGroup>(`/admin/groups/${id}`),
  createGroup: (data: { name: string; description?: string }) =>
    request<AdminGroup>('/admin/groups', { method: 'POST', body: JSON.stringify(data) }),
  updateGroup: (id: string, data: { name?: string; description?: string }) =>
    request<AdminGroup>(`/admin/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGroup: (id: string) =>
    request<{ success: boolean }>(`/admin/groups/${id}`, { method: 'DELETE' }),
  addGroupMember: (groupId: string, data: { email: string; role?: string }) =>
    request<unknown>(`/admin/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  removeGroupMember: (groupId: string, memberId: string) =>
    request<{ success: boolean }>(`/admin/groups/${groupId}/members/${memberId}`, {
      method: 'DELETE',
    }),

  // Audit
  getAuditLog: (params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.offset) searchParams.set('offset', params.offset.toString())
    const query = searchParams.toString()
    return request<{ entries: AuditEntry[]; total: number }>(`/admin/audit${query ? `?${query}` : ''}`)
  },
}
