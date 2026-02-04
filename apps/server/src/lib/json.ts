import type { KeyValueItem, AuthConfig } from '@api-client/shared'

export function parseJsonArray<T>(json: string | null | undefined): T[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function parseJsonObject<T extends object>(json: string | null | undefined): T {
  if (!json) return {} as T
  try {
    return JSON.parse(json) as T
  } catch {
    return {} as T
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value)
}

export function parseHeaders(json: string): KeyValueItem[] {
  return parseJsonArray<KeyValueItem>(json)
}

export function parseQueryParams(json: string): KeyValueItem[] {
  return parseJsonArray<KeyValueItem>(json)
}

export function parseAuthConfig(json: string): AuthConfig {
  return parseJsonObject<AuthConfig>(json)
}
