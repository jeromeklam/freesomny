import type { KeyValueItem } from '@api-client/shared'

// Re-declare interfaces using structural typing (identical to postman/hoppscotch/openapi)
interface ImportedRequest {
  name: string
  headers: KeyValueItem[]
  queryParams: KeyValueItem[]
}

interface ImportedFolder {
  name: string
  headers: KeyValueItem[]
  queryParams: KeyValueItem[]
  children: ImportedFolder[]
  requests: ImportedRequest[]
}

/**
 * Recursively extract common headers and queryParams from requests
 * into their parent folder, bottom-up.
 *
 * A header/param is "common" if it appears (same key AND value) in >= threshold
 * of the direct requests of a folder.
 *
 * Already-existing folder-level headers are preserved and not duplicated.
 * Disabled items are kept on the request (not considered for extraction).
 *
 * Mutates the folder tree in place for efficiency, returns the same reference.
 */
export function extractCommonParams(
  folder: ImportedFolder,
  threshold = 0.5
): ImportedFolder {
  // Step 1: Recurse into children first (bottom-up)
  for (const child of folder.children) {
    extractCommonParams(child, threshold)
  }

  const requests = folder.requests
  // Nothing to extract with 0 or 1 request
  if (requests.length < 2) {
    return folder
  }

  const minCount = Math.ceil(requests.length * threshold)

  // Extract common headers
  extractItems(
    requests,
    folder,
    'headers',
    minCount
  )

  // Extract common queryParams
  extractItems(
    requests,
    folder,
    'queryParams',
    minCount
  )

  return folder
}

function extractItems(
  requests: ImportedRequest[],
  folder: ImportedFolder,
  field: 'headers' | 'queryParams',
  minCount: number
): void {
  // Count frequency by composite key "key::value"
  const counts = new Map<string, { item: KeyValueItem; count: number }>()

  for (const req of requests) {
    for (const item of req[field]) {
      if (!item.enabled) continue
      const compositeKey = `${item.key}::${item.value}`
      const existing = counts.get(compositeKey)
      if (existing) {
        existing.count++
      } else {
        counts.set(compositeKey, { item, count: 1 })
      }
    }
  }

  // Identify common items (count >= minCount)
  const commonKeys = new Set<string>()
  const toAdd: KeyValueItem[] = []

  for (const [compositeKey, { item, count }] of counts) {
    if (count >= minCount) {
      commonKeys.add(compositeKey)
      // Don't duplicate if folder already has this exact item
      const alreadyExists = folder[field].some(
        (h: KeyValueItem) => h.key === item.key && h.value === item.value && h.enabled
      )
      if (!alreadyExists) {
        toAdd.push({ ...item })
      }
    }
  }

  // Add common items to folder
  folder[field] = [...folder[field], ...toAdd]

  // Remove common items from requests (keep disabled items)
  for (const req of requests) {
    req[field] = req[field].filter((item: KeyValueItem) => {
      if (!item.enabled) return true
      const compositeKey = `${item.key}::${item.value}`
      return !commonKeys.has(compositeKey)
    })
  }
}
