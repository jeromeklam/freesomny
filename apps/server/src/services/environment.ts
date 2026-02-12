import { prisma } from '../lib/prisma.js'
import { DYNAMIC_VARIABLES } from '@api-client/shared'
import { randomUUID } from 'crypto'

interface ResolvedVariable {
  key: string
  value: string
  source: 'team' | 'local' | 'dynamic'
  isSecret: boolean
}

// Get the active environment
export async function getActiveEnvironment() {
  return prisma.environment.findFirst({
    where: { isActive: true },
    include: { variables: true },
  })
}

// Resolve all variables for an environment (team + local overrides)
export async function resolveVariables(environmentId: string, userId = 'local'): Promise<Map<string, ResolvedVariable>> {
  const resolved = new Map<string, ResolvedVariable>()

  // Get team variables
  const variables = await prisma.environmentVariable.findMany({
    where: { environmentId },
  })

  for (const v of variables) {
    resolved.set(v.key, {
      key: v.key,
      value: v.value,
      source: 'team',
      isSecret: v.isSecret,
    })
  }

  // Get local overrides (higher priority)
  const overrides = await prisma.localOverride.findMany({
    where: { environmentId, userId },
  })

  for (const o of overrides) {
    resolved.set(o.key, {
      key: o.key,
      value: o.value,
      source: 'local',
      isSecret: resolved.get(o.key)?.isSecret ?? false,
    })
  }

  return resolved
}

// Generate dynamic variable value
function getDynamicValue(varName: string): string {
  switch (varName) {
    case '$timestamp':
      return Math.floor(Date.now() / 1000).toString()
    case '$timestampMs':
      return Date.now().toString()
    case '$randomUUID':
    case '$guid':
      return randomUUID()
    case '$randomInt':
      return Math.floor(Math.random() * 1001).toString()
    case '$randomString':
      return Math.random().toString(36).substring(2, 15)
    case '$isoTimestamp':
      return new Date().toISOString()
    default:
      return ''
  }
}

// Replace {{variable}} placeholders in a string
export async function interpolateString(
  str: string,
  variables: Map<string, ResolvedVariable>
): Promise<string> {
  // Match {{varName}} patterns
  const pattern = /\{\{([^}]+)\}\}/g

  return str.replace(pattern, (match, varName) => {
    const trimmed = varName.trim()

    // Check for dynamic variables first
    if (trimmed.startsWith('$')) {
      // Handle expressions like {{$timestamp + 3600}}
      if (trimmed.includes('+') || trimmed.includes('-')) {
        const parts = trimmed.split(/([+-])/)
        if (parts.length >= 3) {
          const baseVar = parts[0].trim()
          const operator = parts[1]
          const operand = parseInt(parts[2].trim(), 10)

          if (!isNaN(operand)) {
            const baseValue = getDynamicValue(baseVar)
            const numValue = parseInt(baseValue, 10)
            if (!isNaN(numValue)) {
              const result = operator === '+' ? numValue + operand : numValue - operand
              return result.toString()
            }
          }
        }
      }

      return getDynamicValue(trimmed)
    }

    // Check resolved variables
    const resolved = variables.get(trimmed)
    if (resolved) {
      return resolved.value
    }

    // Return original if not found (keeps placeholder visible for debugging)
    return match
  })
}

// Interpolate all strings in a record
export async function interpolateRecord(
  record: Record<string, string>,
  variables: Map<string, ResolvedVariable>
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(record)) {
    result[key] = await interpolateString(value, variables)
  }

  return result
}

// Get merged view of variables for UI display
export async function getVariablesView(environmentId: string, userId = 'local') {
  const variables = await prisma.environmentVariable.findMany({
    where: { environmentId },
    orderBy: { sortOrder: 'asc' },
  })

  const overrides = await prisma.localOverride.findMany({
    where: { environmentId, userId },
  })

  const overrideMap = new Map(overrides.map(o => [o.key, o]))

  return variables.map(v => {
    const override = overrideMap.get(v.key)
    return {
      key: v.key,
      teamValue: v.value,
      localValue: override?.value ?? null,
      description: v.description,
      type: v.type,
      isSecret: v.isSecret,
      isProtected: 'isProtected' in v ? (v as { isProtected?: boolean }).isProtected ?? false : false,
      category: v.category,
      sortOrder: v.sortOrder,
      status: override ? 'overridden' : 'team',
    }
  })
}
