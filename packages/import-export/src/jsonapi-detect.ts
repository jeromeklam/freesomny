/**
 * Detect if a JSON body string conforms to JSON:API structure.
 * Checks for top-level members: data (with type), errors, jsonapi, meta.
 */
export function isJsonApiBody(body: string): boolean {
  if (!body || !body.trim()) return false

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return false
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return false
  }

  const obj = parsed as Record<string, unknown>

  // Must have jsonapi member, or data with type, or errors array
  if ('jsonapi' in obj) return true

  if ('data' in obj) {
    const data = obj.data
    // data is a resource object with type
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      return 'type' in (data as Record<string, unknown>)
    }
    // data is an array of resource objects
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0]
      if (typeof first === 'object' && first !== null) {
        return 'type' in (first as Record<string, unknown>)
      }
    }
    // data is null (valid JSON:API for empty relationships)
    if (data === null && ('meta' in obj || 'links' in obj)) return true
  }

  if ('errors' in obj && Array.isArray(obj.errors)) return true

  return false
}
