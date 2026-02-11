import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { foldersApi, requestsApi, environmentsApi, historyApi, settingsApi, authApi, agentsApi, groupsApi } from '../lib/api'
import type { PreparedRequest } from '@api-client/shared'
import { executeBrowserFetch } from '../lib/browser-fetch'
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
      queryClient.invalidateQueries({ queryKey: ['folder-inherited'] })
    },
  })
}

export function useFolderInheritedContext(id: string | null) {
  return useQuery({
    queryKey: ['folder-inherited', id],
    queryFn: () => (id ? foldersApi.getInherited(id) : null),
    enabled: !!id,
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

export function useFavorites() {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: requestsApi.getFavorites,
  })
}

export function useToggleFavorite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      requestsApi.update(id, { isFavorite }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      queryClient.invalidateQueries({ queryKey: ['request', id] })
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

export function useSortChildren() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (folderId: string) => foldersApi.sortChildren(folderId),
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
  const sendMode = useAppStore((s) => s.sendMode)
  const selectedAgentId = useAppStore((s) => s.selectedAgentId)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const envId = activeEnvironmentId || undefined

      if (sendMode === 'browser') {
        // Step 1: Prepare (server-side resolve + pre-scripts)
        const prepared = await requestsApi.prepare(id, envId) as PreparedRequest

        if (prepared.skipped) {
          return {
            skipped: true,
            scripts: { pre: prepared.scripts.pre },
          }
        }

        // Step 2: Execute in browser via fetch()
        const httpResponse = await executeBrowserFetch(prepared)

        // Step 3: Report back (server-side post-scripts + history)
        const reportResult = await requestsApi.report(id, {
          requestMeta: prepared.requestMeta,
          response: httpResponse,
          preScriptLogs: prepared.scripts.pre.logs,
          preScriptErrors: prepared.scripts.pre.errors,
        })

        return reportResult
      } else if (sendMode === 'agent' && selectedAgentId) {
        // Send via connected agent
        return requestsApi.send(id, envId, 'agent', selectedAgentId)
      } else {
        // Default: server-side send
        return requestsApi.send(id, envId)
      }
    },
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

// Agents
export function useAgents() {
  const sendMode = useAppStore((s) => s.sendMode)

  return useQuery({
    queryKey: ['agents'],
    queryFn: agentsApi.list,
    refetchInterval: sendMode === 'agent' ? 10000 : false,
    enabled: sendMode === 'agent',
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

export function useInheritedContext(id: string | null) {
  return useQuery({
    queryKey: ['inherited', id],
    queryFn: () => (id ? requestsApi.getInherited(id) : null),
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

export function useDuplicateEnvironment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: environmentsApi.duplicate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments'] })
    },
  })
}

export function useDeleteEnvironment() {
  const queryClient = useQueryClient()
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const setActiveEnvironmentId = useAppStore((s) => s.setActiveEnvironmentId)

  return useMutation({
    mutationFn: environmentsApi.delete,
    onSuccess: (_, deletedId) => {
      if (activeEnvironmentId === deletedId) {
        setActiveEnvironmentId(null)
      }
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

// Groups (user-facing)
export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: groupsApi.list,
  })
}

export function useAssignFolderToGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, folderId }: { groupId: string; folderId: string }) =>
      groupsApi.assignFolder(groupId, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export function useUnassignFolderFromGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, folderId }: { groupId: string; folderId: string }) =>
      groupsApi.unassignFolder(groupId, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export function useAssignEnvironmentToGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, environmentId }: { groupId: string; environmentId: string }) =>
      groupsApi.assignEnvironment(groupId, environmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export function useUnassignEnvironmentFromGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, environmentId }: { groupId: string; environmentId: string }) =>
      groupsApi.unassignEnvironment(groupId, environmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
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
