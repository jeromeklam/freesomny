import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Folder, Request, Environment, HttpResponse } from '@api-client/shared'
import type { Language } from '../i18n'

interface FolderWithChildren extends Folder {
  children: FolderWithChildren[]
  requests: Request[]
}

export interface OpenTab {
  id: string
  requestId: string
  name: string
  method: string
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
  openRequestTab: (requestId: string, name: string, method: string) => void
  closeRequestTab: (tabId: string) => void
  setActiveRequestTab: (tabId: string) => void
  updateRequestTabInfo: (requestId: string, name: string, method: string) => void

  // Response
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
  showHistory: boolean
  setShowHistory: (show: boolean) => void
  showSettings: boolean
  setShowSettings: (show: boolean) => void
  showEnvironmentModal: boolean
  setShowEnvironmentModal: (show: boolean) => void

  // Language
  language: Language
  setLanguage: (lang: Language) => void
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
      openRequestTab: (requestId, name, method) =>
        set((state) => {
          // Check if tab already exists
          const existingTab = state.openTabs.find((t) => t.requestId === requestId)
          if (existingTab) {
            // Just activate the existing tab
            return { activeRequestTabId: existingTab.id, selectedRequestId: requestId }
          }
          // Create new tab
          const newTab: OpenTab = {
            id: `tab-${Date.now()}`,
            requestId,
            name,
            method,
          }
          return {
            openTabs: [...state.openTabs, newTab],
            activeRequestTabId: newTab.id,
            selectedRequestId: requestId,
          }
        }),
      closeRequestTab: (tabId) =>
        set((state) => {
          const tabIndex = state.openTabs.findIndex((t) => t.id === tabId)
          if (tabIndex === -1) return state

          const newTabs = state.openTabs.filter((t) => t.id !== tabId)
          let newActiveTabId = state.activeRequestTabId
          let newSelectedRequestId = state.selectedRequestId

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
            }
          }

          return {
            openTabs: newTabs,
            activeRequestTabId: newActiveTabId,
            selectedRequestId: newSelectedRequestId,
          }
        }),
      setActiveRequestTab: (tabId) =>
        set((state) => {
          const tab = state.openTabs.find((t) => t.id === tabId)
          if (!tab) return state
          return {
            activeRequestTabId: tabId,
            selectedRequestId: tab.requestId,
            selectedFolderId: null,
          }
        }),
      updateRequestTabInfo: (requestId, name, method) =>
        set((state) => ({
          openTabs: state.openTabs.map((t) =>
            t.requestId === requestId ? { ...t, name, method } : t
          ),
        })),

      // Response
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
      setActiveEnvironmentId: (id) => set({ activeEnvironmentId: id }),

      // UI State
      activeTab: 'params',
      setActiveTab: (tab) => set({ activeTab: tab }),
      responseTab: 'body',
      setResponseTab: (tab) => set({ responseTab: tab }),
      sidebarWidth: 280,
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      showHistory: false,
      setShowHistory: (show) => set({ showHistory: show }),
      showSettings: false,
      setShowSettings: (show) => set({ showSettings: show }),
      showEnvironmentModal: false,
      setShowEnvironmentModal: (show) => set({ showEnvironmentModal: show }),

      // Language - detect browser language, default to 'en'
      language: getInitialLanguage(),
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'freesomnia-settings',
      partialize: (state) => ({
        language: state.language,
        sidebarWidth: state.sidebarWidth,
      }),
    }
  )
)
