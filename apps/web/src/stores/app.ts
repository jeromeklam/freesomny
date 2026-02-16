import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Folder, Request, Environment, HttpResponse, SendMode } from '@api-client/shared'
import type { Language } from '../i18n'

export type Theme = 'light' | 'dark' | 'auto'

interface FolderWithChildren extends Folder {
  children: FolderWithChildren[]
  requests: Request[]
}

export interface OpenTab {
  id: string
  requestId: string
  name: string
  method: string
  environmentId?: string | null
  folderId?: string | null
  sendMode?: SendMode
  selectedAgentId?: string | null
}

export interface TabResponseData {
  response: HttpResponse | null
  error: string | null
  isLoading: boolean
  scriptLogs: Array<{ source: string; message: string }>
  scriptErrors: Array<{ source: string; message: string }>
  scriptTests: Array<{ source: string; name: string; passed: boolean }>
}

const emptyTabResponse: TabResponseData = {
  response: null,
  error: null,
  isLoading: false,
  scriptLogs: [],
  scriptErrors: [],
  scriptTests: [],
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
}

interface AppState {
  // Auth
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  authRequired: boolean
  setAuthRequired: (required: boolean) => void
  setupRequired: boolean
  setSetupRequired: (required: boolean) => void

  // Folders
  folders: FolderWithChildren[]
  setFolders: (folders: FolderWithChildren[]) => void
  selectedFolderId: string | null
  setSelectedFolderId: (id: string | null) => void
  expandedFolders: Set<string>
  toggleFolderExpanded: (id: string) => void

  // Requests
  selectedRequestId: string | null
  setSelectedRequestId: (id: string | null) => void
  currentRequest: Request | null
  setCurrentRequest: (request: Request | null) => void

  // Request Tabs (multiple open requests)
  openTabs: OpenTab[]
  activeRequestTabId: string | null
  openRequestTab: (requestId: string, name: string, method: string, folderId?: string) => void
  closeRequestTab: (tabId: string) => void
  setActiveRequestTab: (tabId: string) => void
  updateRequestTabInfo: (requestId: string, name: string, method: string) => void

  // Response (per-tab)
  tabResponses: Record<string, TabResponseData>
  setTabResponseData: (tabId: string, data: Partial<TabResponseData>) => void
  // Response (global, kept in sync with active tab)
  currentResponse: HttpResponse | null
  setCurrentResponse: (response: HttpResponse | null) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  requestError: string | null
  setRequestError: (error: string | null) => void

  // Scripts output
  scriptLogs: Array<{ source: string; message: string }>
  scriptErrors: Array<{ source: string; message: string }>
  scriptTests: Array<{ source: string; name: string; passed: boolean }>
  setScriptOutput: (output: {
    logs: Array<{ source: string; message: string }>
    errors: Array<{ source: string; message: string }>
    tests: Array<{ source: string; name: string; passed: boolean }>
  }) => void
  clearScriptOutput: () => void

  // Environments
  environments: Environment[]
  setEnvironments: (environments: Environment[]) => void
  activeEnvironmentId: string | null
  setActiveEnvironmentId: (id: string | null) => void

  // UI State
  activeTab: 'params' | 'headers' | 'auth' | 'body' | 'scripts' | 'resolved'
  setActiveTab: (tab: AppState['activeTab']) => void
  responseTab: 'body' | 'headers' | 'cookies' | 'tests' | 'console'
  setResponseTab: (tab: AppState['responseTab']) => void
  sidebarWidth: number
  setSidebarWidth: (width: number) => void
  favoritesExpanded: boolean
  setFavoritesExpanded: (expanded: boolean) => void
  showHistory: boolean
  setShowHistory: (show: boolean) => void
  showSettings: boolean
  setShowSettings: (show: boolean) => void
  showEnvironmentModal: boolean
  setShowEnvironmentModal: (show: boolean) => void
  showAdmin: boolean
  setShowAdmin: (show: boolean) => void
  showChangelog: boolean
  setShowChangelog: (show: boolean) => void

  // Per-tab env lock
  lockEnvPerTab: boolean
  setLockEnvPerTab: (locked: boolean) => void

  // Send mode
  sendMode: SendMode
  setSendMode: (mode: SendMode) => void
  selectedAgentId: string | null
  setSelectedAgentId: (id: string | null) => void

  // Language
  language: Language
  setLanguage: (lang: Language) => void

  // Theme
  theme: Theme
  setTheme: (theme: Theme) => void

  // Full reset (logout)
  resetStore: () => void
}

// Helper to get initial theme (from localStorage, default to 'dark')
const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('freesomnia-settings')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.state?.theme) {
          return parsed.state.theme as Theme
        }
      } catch {
        // Invalid JSON, use default
      }
    }
  }
  return 'dark'
}

// Helper to get initial language (from localStorage or browser)
const getInitialLanguage = (): Language => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('freesomnia-settings')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.state?.language) {
          return parsed.state.language as Language
        }
      } catch {
        // Invalid JSON, use browser default
      }
    }
    return navigator.language.startsWith('fr') ? 'fr' : 'en'
  }
  return 'en'
}

// Walk the folder tree to find the root collection a folderId belongs to
function containsFolder(folder: FolderWithChildren, folderId: string): boolean {
  if (folder.id === folderId) return true
  return folder.children.some(child => containsFolder(child, folderId))
}

function findRootFolderId(folders: FolderWithChildren[], folderId: string): string | null {
  for (const root of folders) {
    if (containsFolder(root, folderId)) return root.id
  }
  return null
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      user: null,
      setUser: (user) => set({ user }),
      authRequired: false,
      setAuthRequired: (required) => set({ authRequired: required }),
      setupRequired: false,
      setSetupRequired: (required) => set({ setupRequired: required }),

      // Folders
      folders: [],
      setFolders: (folders) => set({ folders }),
      selectedFolderId: null,
      setSelectedFolderId: (id) => set({ selectedFolderId: id }),
      expandedFolders: new Set(),
      toggleFolderExpanded: (id) =>
        set((state) => {
          const next = new Set(state.expandedFolders)
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
          return { expandedFolders: next }
        }),

      // Requests
      selectedRequestId: null,
      setSelectedRequestId: (id) => set({ selectedRequestId: id }),
      currentRequest: null,
      setCurrentRequest: (request) => set({ currentRequest: request }),

      // Request Tabs (multiple open requests)
      openTabs: [],
      activeRequestTabId: null,
      openRequestTab: (requestId, name, method, folderId?) =>
        set((state) => {
          // Check if tab already exists
          const existingTab = state.openTabs.find((t) => t.requestId === requestId)
          if (existingTab) {
            // Activate existing tab; restore env only if lockEnvPerTab is on
            const tabResponse = state.tabResponses[existingTab.id] || emptyTabResponse
            return {
              activeRequestTabId: existingTab.id,
              selectedRequestId: requestId,
              activeEnvironmentId: state.lockEnvPerTab && existingTab.environmentId !== undefined
                ? existingTab.environmentId
                : state.activeEnvironmentId,
              sendMode: existingTab.sendMode ?? state.sendMode,
              selectedAgentId: existingTab.selectedAgentId !== undefined
                ? existingTab.selectedAgentId
                : state.selectedAgentId,
              // Restore response state for this tab
              currentResponse: tabResponse.response,
              requestError: tabResponse.error,
              isLoading: tabResponse.isLoading,
              scriptLogs: tabResponse.scriptLogs,
              scriptErrors: tabResponse.scriptErrors,
              scriptTests: tabResponse.scriptTests,
            }
          }
          // For new tab: try to inherit env from a sibling tab in the same collection
          let envId = state.activeEnvironmentId
          if (folderId) {
            const rootId = findRootFolderId(state.folders, folderId)
            if (rootId) {
              const siblingTab = state.openTabs.find((t) => {
                if (!t.folderId) return false
                return findRootFolderId(state.folders, t.folderId) === rootId
              })
              if (siblingTab?.environmentId !== undefined) {
                envId = siblingTab.environmentId ?? state.activeEnvironmentId
              }
            }
          }
          // Create new tab
          const newTab: OpenTab = {
            id: `tab-${Date.now()}`,
            requestId,
            name,
            method,
            environmentId: envId,
            folderId: folderId || null,
            sendMode: state.sendMode,
            selectedAgentId: state.selectedAgentId,
          }
          return {
            openTabs: [...state.openTabs, newTab],
            activeRequestTabId: newTab.id,
            selectedRequestId: requestId,
            activeEnvironmentId: envId,
            // Clear response state for new tab
            currentResponse: null,
            requestError: null,
            isLoading: false,
            scriptLogs: [],
            scriptErrors: [],
            scriptTests: [],
          }
        }),
      closeRequestTab: (tabId) =>
        set((state) => {
          const tabIndex = state.openTabs.findIndex((t) => t.id === tabId)
          if (tabIndex === -1) return state

          const newTabs = state.openTabs.filter((t) => t.id !== tabId)
          let newActiveTabId = state.activeRequestTabId
          let newSelectedRequestId = state.selectedRequestId
          let newEnvId = state.activeEnvironmentId
          let newSendMode = state.sendMode
          let newAgentId = state.selectedAgentId
          let responseState: TabResponseData = emptyTabResponse

          // If closing the active tab, switch to adjacent tab
          if (state.activeRequestTabId === tabId) {
            if (newTabs.length === 0) {
              newActiveTabId = null
              newSelectedRequestId = null
            } else {
              // Try to select the tab to the left, or the first one
              const newIndex = Math.min(tabIndex, newTabs.length - 1)
              newActiveTabId = newTabs[newIndex].id
              newSelectedRequestId = newTabs[newIndex].requestId
              // Restore adjacent tab's environment (only if lockEnvPerTab) + send mode
              if (state.lockEnvPerTab && newTabs[newIndex].environmentId !== undefined) {
                newEnvId = newTabs[newIndex].environmentId ?? state.activeEnvironmentId
              }
              newSendMode = newTabs[newIndex].sendMode ?? state.sendMode
              if (newTabs[newIndex].selectedAgentId !== undefined) {
                newAgentId = newTabs[newIndex].selectedAgentId ?? state.selectedAgentId
              }
              // Restore adjacent tab's response
              responseState = state.tabResponses[newTabs[newIndex].id] || emptyTabResponse
            }
          }

          // Clean up closed tab's response data
          const newTabResponses = { ...state.tabResponses }
          delete newTabResponses[tabId]

          return {
            openTabs: newTabs,
            activeRequestTabId: newActiveTabId,
            selectedRequestId: newSelectedRequestId,
            activeEnvironmentId: newEnvId,
            sendMode: newSendMode,
            selectedAgentId: newAgentId,
            tabResponses: newTabResponses,
            // Restore response state from adjacent tab (or clear if no tabs left)
            ...(state.activeRequestTabId === tabId ? {
              currentResponse: responseState.response,
              requestError: responseState.error,
              isLoading: responseState.isLoading,
              scriptLogs: responseState.scriptLogs,
              scriptErrors: responseState.scriptErrors,
              scriptTests: responseState.scriptTests,
            } : {}),
          }
        }),
      setActiveRequestTab: (tabId) =>
        set((state) => {
          const tab = state.openTabs.find((t) => t.id === tabId)
          if (!tab) return state
          const tabResponse = state.tabResponses[tabId] || emptyTabResponse
          return {
            activeRequestTabId: tabId,
            selectedRequestId: tab.requestId,
            selectedFolderId: null,
            activeEnvironmentId: state.lockEnvPerTab && tab.environmentId !== undefined
              ? tab.environmentId
              : state.activeEnvironmentId,
            sendMode: tab.sendMode ?? state.sendMode,
            selectedAgentId: tab.selectedAgentId !== undefined
              ? tab.selectedAgentId
              : state.selectedAgentId,
            // Restore response state for this tab
            currentResponse: tabResponse.response,
            requestError: tabResponse.error,
            isLoading: tabResponse.isLoading,
            scriptLogs: tabResponse.scriptLogs,
            scriptErrors: tabResponse.scriptErrors,
            scriptTests: tabResponse.scriptTests,
          }
        }),
      updateRequestTabInfo: (requestId, name, method) =>
        set((state) => ({
          openTabs: state.openTabs.map((t) =>
            t.requestId === requestId ? { ...t, name, method } : t
          ),
        })),

      // Response (per-tab)
      tabResponses: {},
      setTabResponseData: (tabId, data) =>
        set((state) => {
          const existing = state.tabResponses[tabId] || emptyTabResponse
          const updated = { ...existing, ...data }
          const newTabResponses = { ...state.tabResponses, [tabId]: updated }
          // If this is the active tab, also update global fields
          if (tabId === state.activeRequestTabId) {
            return {
              tabResponses: newTabResponses,
              currentResponse: updated.response,
              requestError: updated.error,
              isLoading: updated.isLoading,
              scriptLogs: updated.scriptLogs,
              scriptErrors: updated.scriptErrors,
              scriptTests: updated.scriptTests,
            }
          }
          return { tabResponses: newTabResponses }
        }),
      // Response (global, kept in sync with active tab)
      currentResponse: null,
      setCurrentResponse: (response) => set({ currentResponse: response }),
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),
      requestError: null,
      setRequestError: (error) => set({ requestError: error }),

      // Scripts output
      scriptLogs: [],
      scriptErrors: [],
      scriptTests: [],
      setScriptOutput: ({ logs, errors, tests }) =>
        set({ scriptLogs: logs, scriptErrors: errors, scriptTests: tests }),
      clearScriptOutput: () =>
        set({ scriptLogs: [], scriptErrors: [], scriptTests: [] }),

      // Environments
      environments: [],
      setEnvironments: (environments) => set({ environments }),
      activeEnvironmentId: null,
      setActiveEnvironmentId: (id) => set((state) => ({
        activeEnvironmentId: id,
        openTabs: state.openTabs.map((t) =>
          t.id === state.activeRequestTabId ? { ...t, environmentId: id } : t
        ),
      })),

      // UI State
      activeTab: 'params',
      setActiveTab: (tab) => set({ activeTab: tab }),
      responseTab: 'body',
      setResponseTab: (tab) => set({ responseTab: tab }),
      sidebarWidth: 280,
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      favoritesExpanded: true,
      setFavoritesExpanded: (expanded) => set({ favoritesExpanded: expanded }),
      showHistory: false,
      setShowHistory: (show) => set({ showHistory: show }),
      showSettings: false,
      setShowSettings: (show) => set({ showSettings: show }),
      showEnvironmentModal: false,
      setShowEnvironmentModal: (show) => set({ showEnvironmentModal: show }),
      showAdmin: false,
      setShowAdmin: (show) => set({ showAdmin: show }),
      showChangelog: false,
      setShowChangelog: (show) => set({ showChangelog: show }),

      // Per-tab env lock (default: off — global env)
      lockEnvPerTab: false,
      setLockEnvPerTab: (locked) => set({ lockEnvPerTab: locked }),

      // Send mode
      sendMode: 'server' as SendMode,
      setSendMode: (mode) => set((state) => ({
        sendMode: mode,
        openTabs: state.openTabs.map((t) =>
          t.id === state.activeRequestTabId ? { ...t, sendMode: mode } : t
        ),
      })),
      selectedAgentId: null,
      setSelectedAgentId: (id) => set((state) => ({
        selectedAgentId: id,
        openTabs: state.openTabs.map((t) =>
          t.id === state.activeRequestTabId ? { ...t, selectedAgentId: id } : t
        ),
      })),

      // Language - detect browser language, default to 'en'
      language: getInitialLanguage(),
      setLanguage: (lang) => set({ language: lang }),

      // Theme - default to 'dark'
      theme: getInitialTheme(),
      setTheme: (theme) => set({ theme }),

      // Full reset on logout — clears all state to defaults
      resetStore: () => set({
        user: null,
        folders: [],
        selectedFolderId: null,
        expandedFolders: new Set(),
        selectedRequestId: null,
        currentRequest: null,
        openTabs: [],
        activeRequestTabId: null,
        tabResponses: {},
        currentResponse: null,
        isLoading: false,
        requestError: null,
        scriptLogs: [],
        scriptErrors: [],
        scriptTests: [],
        environments: [],
        activeEnvironmentId: null,
        activeTab: 'params',
        responseTab: 'body',
        sidebarWidth: 280,
        favoritesExpanded: true,
        showHistory: false,
        showSettings: false,
        showEnvironmentModal: false,
        showAdmin: false,
        showChangelog: false,
        sendMode: 'server' as SendMode,
        selectedAgentId: null,
        language: navigator.language.startsWith('fr') ? 'fr' : 'en',
        theme: 'dark',
      }),
    }),
    {
      name: 'freesomnia-settings',
      partialize: (state) => ({
        language: state.language,
        theme: state.theme,
        sidebarWidth: state.sidebarWidth,
        favoritesExpanded: state.favoritesExpanded,
        sendMode: state.sendMode,
        selectedAgentId: state.selectedAgentId,
        lockEnvPerTab: state.lockEnvPerTab,
      }),
    }
  )
)
