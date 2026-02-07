import { useState, useMemo } from 'react'
import { X, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { JSONAPI_FILTER_OPERATORS } from '@api-client/shared'
import type { KeyValueItem } from '@api-client/shared'
import { useTranslation } from '../hooks/useTranslation'
import { ResizableModal } from './ResizableModal'
import {
  JsonApiFilterBuilder,
  type FilterState,
  type FilterGroup,
  type FilterCondition,
  type LogicalOperator,
} from './jsonapi/JsonApiFilterBuilder'
import { JsonApiSortBuilder, type SortField } from './jsonapi/JsonApiSortBuilder'
import { JsonApiIncludeBuilder, type IncludeRelation } from './jsonapi/JsonApiIncludeBuilder'
import { JsonApiPageBuilder, type PageState } from './jsonapi/JsonApiPageBuilder'
import { JsonApiFieldsBuilder, type FieldsetEntry } from './jsonapi/JsonApiFieldsBuilder'
import { JsonApiOptionBuilder, type OptionEntry } from './jsonapi/JsonApiOptionBuilder'

interface JsonApiQueryModalProps {
  queryParams: KeyValueItem[]
  onApply: (params: KeyValueItem[]) => void
  onClose: () => void
}

type Tab = 'filters' | 'sort' | 'include' | 'page' | 'fields' | 'option'

// --- Parsing: KeyValueItem[] → structured state ---

function isJsonApiParam(key: string): boolean {
  return (
    key === 'sort' ||
    key === 'include' ||
    key.startsWith('filter[') ||
    key.startsWith('filter%5B') ||
    key.startsWith('page[') ||
    key.startsWith('page%5B') ||
    key.startsWith('fields[') ||
    key.startsWith('fields%5B') ||
    key.startsWith('option[') ||
    key.startsWith('option%5B')
  )
}

function parseFilters(params: KeyValueItem[]): FilterState {
  const filterParams = params.filter(
    (p) => p.key.startsWith('filter[') || p.key.startsWith('filter%5B')
  )

  if (filterParams.length === 0) {
    return { logic: 'and', groups: [] }
  }

  // Try to detect OR groups: filter[or][N][field][op]=value
  const orGroupRegex = /^filter\[or\]\[(\d+)\]\[([^\]]+)\](?:\[([^\]]+)\])?$/
  const orGroups = new Map<number, FilterCondition[]>()
  const simpleConditions: FilterCondition[] = []
  let hasOrGroups = false

  for (const p of filterParams) {
    const orMatch = p.key.match(orGroupRegex)
    if (orMatch) {
      hasOrGroups = true
      const groupIdx = parseInt(orMatch[1])
      const field = orMatch[2]
      const operator = orMatch[3] || 'eq'
      if (!orGroups.has(groupIdx)) orGroups.set(groupIdx, [])
      orGroups.get(groupIdx)!.push({
        id: `flt_parse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        field,
        operator,
        value: p.value,
        enabled: p.enabled,
      })
    } else {
      // Simple filter: filter[field]=value or filter[field][op]=value
      const simpleRegex = /^filter\[([^\]]+)\](?:\[([^\]]+)\])?$/
      const match = p.key.match(simpleRegex)
      if (match) {
        const field = match[1]
        const operator = match[2] || 'eq'
        simpleConditions.push({
          id: `flt_parse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          field,
          operator,
          value: p.value,
          enabled: p.enabled,
        })
      }
    }
  }

  if (hasOrGroups) {
    const groups: FilterGroup[] = []
    for (const [, conditions] of [...orGroups.entries()].sort((a, b) => a[0] - b[0])) {
      groups.push({
        id: `grp_parse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        logic: 'and',
        conditions,
      })
    }
    return { logic: 'or', groups }
  }

  // All simple conditions go into a single AND group
  if (simpleConditions.length > 0) {
    return {
      logic: 'and',
      groups: [
        {
          id: `grp_parse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          logic: 'and',
          conditions: simpleConditions,
        },
      ],
    }
  }

  return { logic: 'and', groups: [] }
}

function parseSort(params: KeyValueItem[]): SortField[] {
  const sortParam = params.find((p) => p.key === 'sort')
  if (!sortParam || !sortParam.value) return []

  return sortParam.value.split(',').map((part) => {
    const trimmed = part.trim()
    if (trimmed.startsWith('-')) {
      return {
        id: `sort_parse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        field: trimmed.slice(1),
        direction: 'desc' as const,
      }
    }
    return {
      id: `sort_parse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      field: trimmed.startsWith('+') ? trimmed.slice(1) : trimmed,
      direction: 'asc' as const,
    }
  })
}

function parseInclude(params: KeyValueItem[]): IncludeRelation[] {
  const includeParam = params.find((p) => p.key === 'include')
  if (!includeParam || !includeParam.value) return []

  return includeParam.value.split(',').map((name) => ({
    id: `inc_parse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    enabled: includeParam.enabled,
  }))
}

function parsePage(params: KeyValueItem[]): PageState {
  const pageRegex = /^page\[(\w+)\]$/
  let offset = ''
  let limit = ''

  for (const p of params) {
    const match = p.key.match(pageRegex)
    if (match) {
      if (match[1] === 'offset') offset = p.value
      else if (match[1] === 'limit') limit = p.value
    }
  }

  return { offset, limit }
}

function parseFields(params: KeyValueItem[]): FieldsetEntry[] {
  const fieldsRegex = /^fields\[([^\]]+)\]$/
  const entries: FieldsetEntry[] = []

  for (const p of params) {
    const match = p.key.match(fieldsRegex)
    if (match) {
      entries.push({
        id: `fields_parse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        resourceType: match[1],
        fields: p.value,
      })
    }
  }

  return entries
}

function parseOption(params: KeyValueItem[]): OptionEntry[] {
  const optionRegex = /^option\[([^\]]+)\]$/
  const entries: OptionEntry[] = []

  for (const p of params) {
    const match = p.key.match(optionRegex)
    if (match) {
      entries.push({
        id: `opt_parse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        key: match[1],
        enabled: p.enabled,
      })
    }
  }

  return entries
}

// --- Generation: structured state → KeyValueItem[] ---

function generateFilterParams(state: FilterState): KeyValueItem[] {
  const items: KeyValueItem[] = []

  // Skip empty groups / empty conditions
  const validGroups = state.groups.filter((g) =>
    g.conditions.some((c) => c.field.trim() !== '')
  )

  if (validGroups.length === 0) return items

  // Single group with AND logic → simple filter[field][op]=value
  if (validGroups.length === 1 && state.logic === 'and') {
    const group = validGroups[0]
    for (const cond of group.conditions) {
      if (!cond.field.trim()) continue
      const op = JSONAPI_FILTER_OPERATORS.find((o) => o.value === cond.operator)
      const needsValue = op?.needsValue ?? true

      if (cond.operator === 'eq') {
        // Simple equality: filter[field]=value
        items.push({
          key: `filter[${cond.field}]`,
          value: cond.value,
          enabled: cond.enabled,
          description: `${cond.field} = ${cond.value}`,
        })
      } else {
        items.push({
          key: `filter[${cond.field}][${cond.operator}]`,
          value: needsValue ? cond.value : '1',
          enabled: cond.enabled,
          description: `${cond.field} ${op?.symbol || cond.operator} ${needsValue ? cond.value : ''}`.trim(),
        })
      }
    }
    return items
  }

  // Multiple groups or OR logic → filter[or][N][field][op]=value
  if (state.logic === 'or') {
    validGroups.forEach((group, groupIdx) => {
      for (const cond of group.conditions) {
        if (!cond.field.trim()) continue
        const op = JSONAPI_FILTER_OPERATORS.find((o) => o.value === cond.operator)
        const needsValue = op?.needsValue ?? true

        if (cond.operator === 'eq') {
          items.push({
            key: `filter[or][${groupIdx}][${cond.field}]`,
            value: cond.value,
            enabled: cond.enabled,
            description: `OR group ${groupIdx + 1}: ${cond.field} = ${cond.value}`,
          })
        } else {
          items.push({
            key: `filter[or][${groupIdx}][${cond.field}][${cond.operator}]`,
            value: needsValue ? cond.value : '1',
            enabled: cond.enabled,
            description: `OR group ${groupIdx + 1}: ${cond.field} ${op?.symbol || cond.operator} ${needsValue ? cond.value : ''}`.trim(),
          })
        }
      }
    })
    return items
  }

  // Multiple AND groups: flatten all conditions as simple filters
  for (const group of validGroups) {
    for (const cond of group.conditions) {
      if (!cond.field.trim()) continue
      const op = JSONAPI_FILTER_OPERATORS.find((o) => o.value === cond.operator)
      const needsValue = op?.needsValue ?? true

      if (cond.operator === 'eq') {
        items.push({
          key: `filter[${cond.field}]`,
          value: cond.value,
          enabled: cond.enabled,
          description: `${cond.field} = ${cond.value}`,
        })
      } else {
        items.push({
          key: `filter[${cond.field}][${cond.operator}]`,
          value: needsValue ? cond.value : '1',
          enabled: cond.enabled,
          description: `${cond.field} ${op?.symbol || cond.operator} ${needsValue ? cond.value : ''}`.trim(),
        })
      }
    }
  }

  return items
}

function generateSortParam(fields: SortField[]): KeyValueItem | null {
  const validFields = fields.filter((f) => f.field.trim() !== '')
  if (validFields.length === 0) return null

  const value = validFields
    .map((f) => (f.direction === 'desc' ? `-${f.field}` : `${f.field}`))
    .join(',')

  return {
    key: 'sort',
    value,
    enabled: true,
    description: `Sort: ${value}`,
  }
}

function generateIncludeParam(relations: IncludeRelation[]): KeyValueItem | null {
  const enabled = relations.filter((r) => r.enabled && r.name.trim() !== '')
  if (enabled.length === 0) return null

  return {
    key: 'include',
    value: enabled.map((r) => r.name.trim()).join(','),
    enabled: true,
    description: `Include: ${enabled.map((r) => r.name).join(', ')}`,
  }
}

function generatePageParams(state: PageState): KeyValueItem[] {
  const items: KeyValueItem[] = []

  if (state.offset.trim() !== '') {
    items.push({
      key: 'page[offset]',
      value: state.offset.trim(),
      enabled: true,
      description: `Page offset: ${state.offset}`,
    })
  }

  if (state.limit.trim() !== '') {
    items.push({
      key: 'page[limit]',
      value: state.limit.trim(),
      enabled: true,
      description: `Page limit: ${state.limit}`,
    })
  }

  return items
}

function generateFieldsParams(entries: FieldsetEntry[]): KeyValueItem[] {
  return entries
    .filter((e) => e.resourceType.trim() !== '' && e.fields.trim() !== '')
    .map((e) => ({
      key: `fields[${e.resourceType.trim()}]`,
      value: e.fields.trim(),
      enabled: true,
      description: `Fields for ${e.resourceType}: ${e.fields}`,
    }))
}

function generateOptionParams(entries: OptionEntry[]): KeyValueItem[] {
  return entries
    .filter((e) => e.key.trim() !== '')
    .map((e) => ({
      key: `option[${e.key.trim()}]`,
      value: '',
      enabled: e.enabled,
      description: `Option: ${e.key}`,
    }))
}

export function JsonApiQueryModal({ queryParams, onApply, onClose }: JsonApiQueryModalProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('filters')

  // Parse existing queryParams into structured state on mount
  const initialState = useMemo(() => {
    return {
      filters: parseFilters(queryParams),
      sort: parseSort(queryParams),
      include: parseInclude(queryParams),
      page: parsePage(queryParams),
      fields: parseFields(queryParams),
      option: parseOption(queryParams),
      otherParams: queryParams.filter((p) => !isJsonApiParam(p.key)),
    }
  }, []) // Intentionally empty deps: parse only on mount

  const [filters, setFilters] = useState<FilterState>(initialState.filters)
  const [sort, setSort] = useState<SortField[]>(initialState.sort)
  const [include, setInclude] = useState<IncludeRelation[]>(initialState.include)
  const [page, setPage] = useState<PageState>(initialState.page)
  const [fields, setFields] = useState<FieldsetEntry[]>(initialState.fields)
  const [option, setOption] = useState<OptionEntry[]>(initialState.option)

  const handleApply = () => {
    const newParams: KeyValueItem[] = [...initialState.otherParams]

    // Generate filter params
    newParams.push(...generateFilterParams(filters))

    // Generate sort param
    const sortParam = generateSortParam(sort)
    if (sortParam) newParams.push(sortParam)

    // Generate include param
    const includeParam = generateIncludeParam(include)
    if (includeParam) newParams.push(includeParam)

    // Generate page params
    newParams.push(...generatePageParams(page))

    // Generate fields params
    newParams.push(...generateFieldsParams(fields))

    // Generate option params
    newParams.push(...generateOptionParams(option))

    onApply(newParams)
    onClose()
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'filters', label: t('jsonapi.tabs.filters') },
    { id: 'sort', label: t('jsonapi.tabs.sort') },
    { id: 'include', label: t('jsonapi.tabs.include') },
    { id: 'page', label: t('jsonapi.tabs.page') },
    { id: 'fields', label: t('jsonapi.tabs.fields') },
    { id: 'option', label: t('jsonapi.tabs.option') },
  ]

  // Count badges
  const filterCount = filters.groups.reduce(
    (sum, g) => sum + g.conditions.filter((c) => c.field.trim() !== '').length,
    0
  )
  const sortCount = sort.filter((f) => f.field.trim() !== '').length
  const includeCount = include.filter((r) => r.name.trim() !== '' && r.enabled).length
  const pageCount = (page.offset.trim() !== '' ? 1 : 0) + (page.limit.trim() !== '' ? 1 : 0)
  const fieldsCount = fields.filter((e) => e.resourceType.trim() !== '' && e.fields.trim() !== '').length
  const optionCount = option.filter((e) => e.key.trim() !== '' && e.enabled).length

  const counts: Record<Tab, number> = {
    filters: filterCount,
    sort: sortCount,
    include: includeCount,
    page: pageCount,
    fields: fieldsCount,
    option: optionCount,
  }

  return (
    <ResizableModal
      storageKey="jsonapi-query"
      defaultWidth={800}
      defaultHeight={Math.min(window.innerHeight * 0.8, 600)}
      minWidth={500}
      minHeight={350}
      onClose={onClose}
      className="bg-gray-800"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold">{t('jsonapi.title')}</h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            )}
          >
            {tab.label}
            {counts[tab.id] > 0 && (
              <span
                className={clsx(
                  'px-1.5 py-0.5 rounded-full text-xs font-semibold',
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400'
                )}
              >
                {counts[tab.id]}
              </span>
            )}
          </button>
        ))}

        {/* Apply button in tab bar */}
        <button
          onClick={handleApply}
          className="ml-auto mr-3 flex items-center gap-1 px-3 py-1 my-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
        >
          <Check className="w-4 h-4" />
          {t('jsonapi.apply')}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'filters' && (
          <JsonApiFilterBuilder state={filters} onChange={setFilters} />
        )}
        {activeTab === 'sort' && (
          <JsonApiSortBuilder fields={sort} onChange={setSort} />
        )}
        {activeTab === 'include' && (
          <JsonApiIncludeBuilder relations={include} onChange={setInclude} />
        )}
        {activeTab === 'page' && (
          <JsonApiPageBuilder state={page} onChange={setPage} />
        )}
        {activeTab === 'fields' && (
          <JsonApiFieldsBuilder entries={fields} onChange={setFields} />
        )}
        {activeTab === 'option' && (
          <JsonApiOptionBuilder entries={option} onChange={setOption} />
        )}
      </div>
    </ResizableModal>
  )
}
