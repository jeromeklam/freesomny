import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Folder, Request, Environment, HttpResponse } from '@api-client/shared'
import type { Language } from '../i18n'

interface FolderWithChildren extends Folder {
  children: FolderWithChildren[]
  requests: Request[]
}

interface AppState {
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

  // Response
  currentResponse: HttpResponse | null
  setCurrentResponse: (response: HttpResponse | null) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

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

export const useAppStore = create<AppState>((set) => ({
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

  // Response
  currentResponse: null,
  setCurrentResponse: (response) => set({ currentResponse: response }),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

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
  language: (navigator.language.startsWith('fr') ? 'fr' : 'en') as Language,
  setLanguage: (lang) => set({ language: lang }),
}))
