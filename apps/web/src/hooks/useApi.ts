import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { foldersApi, requestsApi, environmentsApi, historyApi, settingsApi, authApi } from '../lib/api'
import { useAppStore } from '../stores/app'

// Folders
export function useFolders() {
  const setFolders = useAppStore((s) => s.setFolders)

  return useQuery({
    queryKey: ['folders'],
    queryFn: async () => {
      const folders = await foldersApi.list()
      setFolders(folders as ReturnType<typeof useAppStore.getState>['folders'])
      return folders
    },
  })
}

export function useFolder(id: string | null) {
  return useQuery({
    queryKey: ['folder', id],
    queryFn: () => (id ? foldersApi.get(id) : null),
    enabled: !!id,
  })
}

export function useCreateFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: foldersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })
}

export function useUpdateFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => foldersApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      queryClient.invalidateQueries({ queryKey: ['folder', id] })
    },
  })
}

export function useDeleteFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: foldersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })
}

// Requests
export function useRequest(id: string | null) {
  return useQuery({
    queryKey: ['request', id],
    queryFn: () => (id ? requestsApi.get(id) : null),
    enabled: !!id,
  })
}

export function useCreateRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: requestsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })
}

export function useUpdateRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => requestsApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      queryClient.invalidateQueries({ queryKey: ['request', id] })
    },
  })
}

export function useDeleteRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: requestsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })
}

export function useDuplicateRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: requestsApi.duplicate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })
}

export function useReorderRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, parentId, sortOrder }: { id: string; parentId: string; sortOrder: number }) =>
      requestsApi.reorder(id, { parentId, sortOrder }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })
}

export function useReorderFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, parentId, sortOrder }: { id: string; parentId: string | null; sortOrder: number }) =>
      foldersApi.reorder(id, { parentId, sortOrder }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })
}

export function useSendRequest() {
  const setCurrentResponse = useAppStore((s) => s.setCurrentResponse)
  const setIsLoading = useAppStore((s) => s.setIsLoading)
  const setRequestError = useAppStore((s) => s.setRequestError)
  const setScriptOutput = useAppStore((s) => s.setScriptOutput)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => requestsApi.send(id, activeEnvironmentId || undefined),
    onMutate: () => {
      setIsLoading(true)
      setCurrentResponse(null)
      setRequestError(null)
    },
    onSuccess: (data: unknown) => {
      const result = data as {
        response?: {
          status: number
          statusText: string
          headers: Record<string, string>
          body: string
          time: number
          size: number
        }
        scripts?: {
          pre?: { logs: Array<{ source: string; message: string }>; errors: Array<{ source: string; message: string }> }
          post?: {
            logs: Array<{ source: string; message: string }>
            errors: Array<{ source: string; message: string }>
            tests: Array<{ source: string; name: string; passed: boolean }>
          }
        }
        skipped?: boolean
        error?: string
      }

      // Check for error in response (e.g., network error, timeout)
      if (result.error) {
        setRequestError(result.error)
        setCurrentResponse(null)
      } else if (result.response) {
        setCurrentResponse(result.response)
        setRequestError(null)
      }

      // Combine script outputs
      const logs = [...(result.scripts?.pre?.logs || []), ...(result.scripts?.post?.logs || [])]
      const errors = [...(result.scripts?.pre?.errors || []), ...(result.scripts?.post?.errors || [])]
      const tests = result.scripts?.post?.tests || []
      setScriptOutput({ logs, errors, tests })

      // Refresh history
      queryClient.invalidateQueries({ queryKey: ['history'] })
    },
    onError: (error: Error) => {
      // Handle network errors, server unreachable, etc.
      setRequestError(error.message || 'Request failed')
      setCurrentResponse(null)
      setScriptOutput({ logs: [], errors: [], tests: [] })
    },
    onSettled: () => {
      setIsLoading(false)
    },
  })
}

export function useResolvedRequest(id: string | null) {
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)

  return useQuery({
    queryKey: ['resolved', id, activeEnvironmentId],
    queryFn: () => (id ? requestsApi.getResolved(id, activeEnvironmentId || undefined) : null),
    enabled: !!id,
  })
}

// Environments
export function useEnvironments() {
  const setEnvironments = useAppStore((s) => s.setEnvironments)
  const setActiveEnvironmentId = useAppStore((s) => s.setActiveEnvironmentId)

  return useQuery({
    queryKey: ['environments'],
    queryFn: async () => {
      const environments = await environmentsApi.list()
      setEnvironments(environments as ReturnType<typeof useAppStore.getState>['environments'])
      const active = (environments as Array<{ id: string; isActive: boolean }>).find((e) => e.isActive)
      if (active) {
        setActiveEnvironmentId(active.id)
      }
      return environments
    },
  })
}

export function useCreateEnvironment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: environmentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments'] })
    },
  })
}

export function useActivateEnvironment() {
  const queryClient = useQueryClient()
  const setActiveEnvironmentId = useAppStore((s) => s.setActiveEnvironmentId)

  return useMutation({
    mutationFn: environmentsApi.activate,
    onSuccess: (_, id) => {
      setActiveEnvironmentId(id)
      queryClient.invalidateQueries({ queryKey: ['environments'] })
    },
  })
}

export function useEnvironmentVariables(id: string | null) {
  return useQuery({
    queryKey: ['environment-variables', id],
    queryFn: () => (id ? environmentsApi.getVariables(id) : []),
    enabled: !!id,
  })
}

export function useSetEnvironmentVariable() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ envId, key, data }: { envId: string; key: string; data: unknown }) =>
      environmentsApi.setVariable(envId, key, data),
    onSuccess: (_, { envId }) => {
      queryClient.invalidateQueries({ queryKey: ['environment-variables', envId] })
      queryClient.invalidateQueries({ queryKey: ['environments'] })
    },
  })
}

// History
export function useHistory(params?: { limit?: number; offset?: number; search?: string }) {
  return useQuery({
    queryKey: ['history', params],
    queryFn: () => historyApi.list(params),
  })
}

export function useClearHistory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: historyApi.clear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] })
    },
  })
}

// Settings
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

// Auth
export function useAuthStatus() {
  return useQuery({
    queryKey: ['auth-status'],
    queryFn: () => authApi.status(),
  })
}
