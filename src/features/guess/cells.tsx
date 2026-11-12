import type { Cell, Known } from '../../engine/guess'
import { Img } from '../../ui/Img'
import { valueLabel } from '../../ui/labels'

export const COLUMN_ICON: Record<string, string> = {
  gender: '⚥',
  species: '🧬',
  range: '🏹',
  damageType: '⚔️',
  role: '🛡️',
  cost: '💰',
  traits: '🔮',
  set: '🌌',
  region: '🗺️',
  kind: '📦',
  recipe: '🧪',
  stats: '📊',
  firstSet: '🌌',
  setCount: '🔁',
  unique: '☝️',
  champions: '👥',
  tiers: '📶',
  firstTier: '🔢',
  costs: '💰',
}

/** Columns whose values are names we can show as icons. */
const ICON_COLUMNS = new Set(['recipe', 'traits'])

export type IconLookup = (column: string, name: string) => string | undefined

export function CellValue({ column, value, iconOf }: { column: string; value: Cell['value']; iconOf: IconLookup }) {
  if (ICON_COLUMNS.has(column) && Array.isArray(value) && value.length) {
    return (
      <span className="flex flex-wrap items-center justify-center gap-1">
        {value.map((name, i) => {
          const icon = iconOf(column, name)
          return icon ? (
            <span key={i} title={name} className="inline-flex">
              <Img src={icon} name={name} className="h-7 w-7 max-w-none rounded bg-black/30 p-0.5" />
            </span>
          ) : (
            <span key={i}>{name}</span>
          )
        })}
      </span>
    )
  }
  return <>{valueLabel(column, value)}</>
}

function rangeText(column: string, min?: number, max?: number): string {
  const fmt = (n: number) => (column === 'set' || column === 'firstSet' ? `Set ${n}` : String(n))
  if (min !== undefined && max !== undefined) return `${fmt(min)} < ? < ${fmt(max)}`
  if (min !== undefined) return `> ${fmt(min)}`
  return `< ${fmt(max!)}`
}

export function KnownCell({ k, iconOf }: { k: Known; iconOf: IconLookup }) {
  const base = 'flex h-12 min-w-20 items-center justify-center rounded-md px-1 text-center leading-tight'
  switch (k.kind) {
    case 'exact':
      return (
        <div className={`${base} bg-ok`}>
          <CellValue column={k.column} value={k.value} iconOf={iconOf} />
        </div>
      )
    case 'range':
      return <div className={`${base} border border-gold/60 bg-gold-dim text-gold`}>{rangeText(k.column, k.min, k.max)}</div>
    case 'partial':
      return (
        <div className={`${base} bg-part`}>
          <CellValue column={k.column} value={k.value} iconOf={iconOf} />
        </div>
      )
    case 'unknown':
      return <div className={`${base} border border-dashed border-line text-muted`}>?</div>
  }
}
