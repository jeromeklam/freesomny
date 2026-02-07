import { Plus, Trash2, X } from 'lucide-react'
import { clsx } from 'clsx'
import { JSONAPI_FILTER_OPERATORS } from '@api-client/shared'
import { useTranslation } from '../../hooks/useTranslation'

export type LogicalOperator = 'and' | 'or'

export interface FilterCondition {
  id: string
  field: string
  operator: string
  value: string
  enabled: boolean
}

export interface FilterGroup {
  id: string
  logic: LogicalOperator
  conditions: FilterCondition[]
}

export interface FilterState {
  logic: LogicalOperator
  groups: FilterGroup[]
}

interface JsonApiFilterBuilderProps {
  state: FilterState
  onChange: (state: FilterState) => void
}

let nextId = 1
function genId() {
  return `flt_${Date.now()}_${nextId++}`
}

function newCondition(): FilterCondition {
  return { id: genId(), field: '', operator: 'eq', value: '', enabled: true }
}

function newGroup(): FilterGroup {
  return { id: genId(), logic: 'and', conditions: [newCondition()] }
}

function LogicToggle({
  value,
  onChange,
  label,
}: {
  value: LogicalOperator
  onChange: (v: LogicalOperator) => void
  label: string
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex rounded overflow-hidden border border-gray-700">
        <button
          onClick={() => onChange('and')}
          className={clsx(
            'px-2 py-0.5 text-xs font-semibold transition-colors',
            value === 'and'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-300'
          )}
        >
          {t('jsonapi.filters.and')}
        </button>
        <button
          onClick={() => onChange('or')}
          className={clsx(
            'px-2 py-0.5 text-xs font-semibold transition-colors',
            value === 'or'
              ? 'bg-orange-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-300'
          )}
        >
          {t('jsonapi.filters.or')}
        </button>
      </div>
    </div>
  )
}

function ConditionRow({
  condition,
  onChange,
  onRemove,
  showRemove,
}: {
  condition: FilterCondition
  onChange: (c: FilterCondition) => void
  onRemove: () => void
  showRemove: boolean
}) {
  const { t } = useTranslation()
  const op = JSONAPI_FILTER_OPERATORS.find((o) => o.value === condition.operator)
  const needsValue = op?.needsValue ?? true
  const isBetween = condition.operator === 'between'
  const isIn = condition.operator === 'in' || condition.operator === 'nin'

  return (
    <div className="flex items-center gap-2 group">
      <input
        type="checkbox"
        checked={condition.enabled}
        onChange={(e) => onChange({ ...condition, enabled: e.target.checked })}
        className="w-4 h-4 rounded bg-gray-700 border-gray-600 shrink-0"
      />

      {/* Field */}
      <input
        type="text"
        value={condition.field}
        onChange={(e) => onChange({ ...condition, field: e.target.value })}
        placeholder={t('jsonapi.filters.field')}
        className={clsx(
          'w-36 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm font-mono',
          'focus:outline-none focus:border-blue-500',
          !condition.enabled && 'opacity-50'
        )}
      />

      {/* Operator */}
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value })}
        className={clsx(
          'w-40 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm',
          'focus:outline-none focus:border-blue-500',
          !condition.enabled && 'opacity-50'
        )}
      >
        {JSONAPI_FILTER_OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.symbol} {t(`jsonapi.operators.${op.value}`)}
          </option>
        ))}
      </select>

      {/* Value — conditional rendering based on operator */}
      {needsValue && !isBetween && !isIn && (
        <input
          type="text"
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder={t('jsonapi.filters.valuePlaceholder')}
          className={clsx(
            'flex-1 min-w-0 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm font-mono',
            'focus:outline-none focus:border-blue-500',
            !condition.enabled && 'opacity-50'
          )}
        />
      )}

      {needsValue && isBetween && (
        <div className="flex-1 flex items-center gap-1 min-w-0">
          <input
            type="text"
            value={condition.value.split(',')[0] || ''}
            onChange={(e) => {
              const parts = condition.value.split(',')
              onChange({ ...condition, value: `${e.target.value},${parts[1] || ''}` })
            }}
            placeholder={t('jsonapi.filters.valueBetweenMin')}
            className={clsx(
              'flex-1 min-w-0 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm font-mono',
              'focus:outline-none focus:border-blue-500',
              !condition.enabled && 'opacity-50'
            )}
          />
          <span className="text-gray-500 text-xs shrink-0">—</span>
          <input
            type="text"
            value={condition.value.split(',')[1] || ''}
            onChange={(e) => {
              const parts = condition.value.split(',')
              onChange({ ...condition, value: `${parts[0] || ''},${e.target.value}` })
            }}
            placeholder={t('jsonapi.filters.valueBetweenMax')}
            className={clsx(
              'flex-1 min-w-0 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm font-mono',
              'focus:outline-none focus:border-blue-500',
              !condition.enabled && 'opacity-50'
            )}
          />
        </div>
      )}

      {needsValue && isIn && (
        <input
          type="text"
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder={t('jsonapi.filters.valueInPlaceholder')}
          className={clsx(
            'flex-1 min-w-0 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm font-mono',
            'focus:outline-none focus:border-blue-500',
            !condition.enabled && 'opacity-50'
          )}
        />
      )}

      {!needsValue && <div className="flex-1" />}

      {/* Remove */}
      {showRemove && (
        <button
          onClick={onRemove}
          className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

function GroupCard({
  group,
  groupIndex,
  totalGroups,
  onChange,
  onRemove,
}: {
  group: FilterGroup
  groupIndex: number
  totalGroups: number
  onChange: (g: FilterGroup) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()

  const addCondition = () => {
    onChange({ ...group, conditions: [...group.conditions, newCondition()] })
  }

  const removeCondition = (id: string) => {
    onChange({ ...group, conditions: group.conditions.filter((c) => c.id !== id) })
  }

  const updateCondition = (updated: FilterCondition) => {
    onChange({
      ...group,
      conditions: group.conditions.map((c) => (c.id === updated.id ? updated : c)),
    })
  }

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-900/50">
      {/* Group header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-400">
            {t('jsonapi.filters.group')} {groupIndex + 1}
          </span>
          {group.conditions.length > 1 && (
            <LogicToggle
              value={group.logic}
              onChange={(logic) => onChange({ ...group, logic })}
              label={t('jsonapi.filters.betweenConditions')}
            />
          )}
        </div>
        {totalGroups > 1 && (
          <button
            onClick={onRemove}
            className="p-1 text-gray-500 hover:text-red-400"
            title={t('jsonapi.filters.removeGroup')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Conditions */}
      <div className="p-3 space-y-2">
        {group.conditions.map((cond) => (
          <ConditionRow
            key={cond.id}
            condition={cond}
            onChange={updateCondition}
            onRemove={() => removeCondition(cond.id)}
            showRemove={group.conditions.length > 1}
          />
        ))}

        <button
          onClick={addCondition}
          className="flex items-center gap-1 mt-2 px-2 py-1 text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('jsonapi.filters.addCondition')}
        </button>
      </div>
    </div>
  )
}

export function JsonApiFilterBuilder({ state, onChange }: JsonApiFilterBuilderProps) {
  const { t } = useTranslation()

  const addGroup = () => {
    onChange({ ...state, groups: [...state.groups, newGroup()] })
  }

  const removeGroup = (id: string) => {
    onChange({ ...state, groups: state.groups.filter((g) => g.id !== id) })
  }

  const updateGroup = (updated: FilterGroup) => {
    onChange({
      ...state,
      groups: state.groups.map((g) => (g.id === updated.id ? updated : g)),
    })
  }

  if (state.groups.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 text-sm mb-4">{t('jsonapi.filters.noFilters')}</p>
        <button
          onClick={addGroup}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-800 border border-gray-700 rounded"
        >
          <Plus className="w-4 h-4" />
          {t('jsonapi.filters.addGroup')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {/* Top-level logic toggle */}
      {state.groups.length > 1 && (
        <div className="flex justify-center pb-1">
          <LogicToggle
            value={state.logic}
            onChange={(logic) => onChange({ ...state, logic })}
            label={t('jsonapi.filters.betweenGroups')}
          />
        </div>
      )}

      {state.groups.map((group, index) => (
        <div key={group.id}>
          {/* Logic separator between groups */}
          {index > 0 && (
            <div className="flex items-center justify-center py-1">
              <span
                className={clsx(
                  'px-2 py-0.5 rounded text-xs font-semibold',
                  state.logic === 'and'
                    ? 'bg-blue-900/50 text-blue-400'
                    : 'bg-orange-900/50 text-orange-400'
                )}
              >
                {state.logic === 'and' ? t('jsonapi.filters.and') : t('jsonapi.filters.or')}
              </span>
            </div>
          )}
          <GroupCard
            group={group}
            groupIndex={index}
            totalGroups={state.groups.length}
            onChange={updateGroup}
            onRemove={() => removeGroup(group.id)}
          />
        </div>
      ))}

      <button
        onClick={addGroup}
        className="flex items-center gap-1 mt-2 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded"
      >
        <Plus className="w-4 h-4" />
        {t('jsonapi.filters.addGroup')}
      </button>
    </div>
  )
}
