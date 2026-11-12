// Guess mode (design §5.2): pick a hidden target, compare each guess column by column.
import type { Champion, Identities, Item, SetData, Trait } from '../data/types'
import { normalizeAnswer } from './answer'
import { createRng } from './rng'

export type GuessKind = 'champion' | 'item' | 'trait'
export type CellStatus = 'ok' | 'part' | 'no' | 'unknown'
/** where the target is relative to the guess */
export type Arrow = 'up' | 'down'

export interface Cell {
  column: string
  /** raw value of the guess for this column (the UI translates labels) */
  value: string | number | string[] | boolean | null
  status: CellStatus
  arrow?: Arrow
}

export type Entry =
  | { kind: 'champion'; set: SetData; champion: Champion }
  /** Items are merged across sets by name: `set`/`item` are the latest version, `sets` every set it was in. */
  | { kind: 'item'; set: SetData; item: Item; sets: SetData[] }
  | { kind: 'trait'; set: SetData; trait: Trait }

export const entryName = (e: Entry) => (e.kind === 'champion' ? e.champion.name : e.kind === 'item' ? e.item.name : e.trait.name)
export const entryKey = (e: Entry) =>
  e.kind === 'item' ? `item:${normalizeAnswer(e.item.name)}` : `${e.set.id}:${e.kind === 'champion' ? e.champion.key : e.trait.key}`
export const entryIcon = (e: Entry) => (e.kind === 'champion' ? e.champion.icon : e.kind === 'item' ? e.item.icon : e.trait.icon)
export const entryLabel = (e: Entry) => (e.kind === 'item' ? `${entryName(e)} · ${e.sets.length} Set` : `${entryName(e)} · Set ${e.set.id}`)

export const COLUMNS: Record<GuessKind, string[]> = {
  champion: ['gender', 'species', 'range', 'damageType', 'role', 'cost', 'traits', 'set', 'region'],
  item: ['kind', 'recipe', 'stats', 'firstSet', 'setCount', 'unique'],
  // 'type' (origin/class) is left out: the source data does not record it for most sets
  trait: ['set', 'champions', 'tiers', 'firstTier', 'costs'],
}

const sortSets = (sets: SetData[]) => [...sets].sort((a, b) => a.number - b.number || a.id.localeCompare(b.id))

/** Everything that can be typed as a guess (autocomplete list), in a stable order. */
export function allEntries(kind: GuessKind, sets: SetData[]): Entry[] {
  const out: Entry[] = []
  for (const set of sortSets(sets)) {
    if (kind === 'champion') for (const c of [...set.champions].sort((a, b) => a.key.localeCompare(b.key))) out.push({ kind, set, champion: c })
    if (kind === 'trait') for (const t of [...set.traits].sort((a, b) => a.key.localeCompare(b.key))) out.push({ kind, set, trait: t })
  }
  if (kind === 'item') {
    // one entry per item name; the latest set's version describes it
    const byName = new Map<string, { set: SetData; item: Item; sets: SetData[] }>()
    for (const set of sortSets(sets)) {
      for (const item of set.items) {
        const k = normalizeAnswer(item.name)
        const prev = byName.get(k)
        if (prev) {
          if (!prev.sets.includes(set)) prev.sets.push(set)
          prev.set = set
          prev.item = item
        } else byName.set(k, { set, item, sets: [set] })
      }
    }
    for (const k of [...byName.keys()].sort()) out.push({ kind: 'item', ...byName.get(k)! })
  }
  return out
}

/** Champions may only be targets once their tags were reviewed and every column has a value. */
export function isEligibleTarget(e: Entry, identities: Identities): boolean {
  if (e.kind !== 'champion') return true
  const id = identities[e.champion.identity]
  return !!id?.reviewed && !!id.gender && !!id.species && !!id.region && !!e.champion.damageType && !!e.champion.role
}

export function eligibleTargets(kind: GuessKind, sets: SetData[], identities: Identities): Entry[] {
  return allEntries(kind, sets).filter((e) => isEligibleTarget(e, identities))
}

/** Share of champion identities (across the given sets) that guess mode can use. */
export function reviewedShare(sets: SetData[], identities: Identities): number {
  const ids = new Set(sets.flatMap((s) => s.champions.map((c) => c.identity)))
  if (!ids.size) return 0
  return [...ids].filter((k) => identities[k]?.reviewed).length / ids.size
}

export const GUESS_UNLOCK_SHARE = 0.8

export function pickTarget(kind: GuessKind, seed: string, sets: SetData[], identities: Identities): Entry | null {
  const pool = eligibleTargets(kind, sets, identities)
  if (!pool.length) return null
  const ids = sortSets(sets).map((s) => s.id).join(',')
  return createRng(`guess|${kind}|${ids}|${seed}`).pick(pool)
}

// ---- comparison helpers

function eq(column: string, g: string | boolean | null | undefined, t: string | boolean | null | undefined): Cell {
  if (g == null || t == null || g === '' || t === '') return { column, value: g ?? null, status: 'unknown' }
  return { column, value: g, status: g === t ? 'ok' : 'no' }
}

function num(column: string, g: number, t: number): Cell {
  return { column, value: g, status: g === t ? 'ok' : 'no', ...(g === t ? {} : { arrow: t > g ? 'up' : 'down' }) }
}

/** ok = same members, part = any overlap, no = none. Two empty lists count as equal. */
function overlap(column: string, g: string[], t: string[]): Cell {
  const gs = new Set(g.map(normalizeAnswer))
  const ts = new Set(t.map(normalizeAnswer))
  const same = gs.size === ts.size && [...gs].every((x) => ts.has(x))
  const any = [...gs].some((x) => ts.has(x))
  return { column, value: g, status: same ? 'ok' : any ? 'part' : 'no' }
}

/** Set column: ok same set; part when it is the same thing (by identity/name) in another set; arrow by set number. */
function setCell(g: Entry, t: Entry, sameThing: boolean): Cell {
  if (g.set.id === t.set.id) return { column: 'set', value: g.set.id, status: 'ok' }
  return {
    column: 'set',
    value: g.set.id,
    status: sameThing ? 'part' : 'no',
    ...(t.set.number === g.set.number ? {} : { arrow: t.set.number > g.set.number ? 'up' : 'down' }),
  }
}

const isMelee = (c: Champion) => c.range <= 1
const traitNames = (set: SetData, keys: string[]) => keys.map((k) => set.traits.find((t) => t.key === k)?.name ?? k)
const itemNames = (set: SetData, keys: string[] | undefined) => (keys ?? []).map((k) => set.items.find((i) => i.key === k)?.name ?? k)
function memberCosts(set: SetData, t: Trait): [number, number] {
  const costs = t.championKeys.map((k) => set.champions.find((c) => c.key === k)?.cost ?? 0).filter((c) => c > 0)
  return costs.length ? [Math.min(...costs), Math.max(...costs)] : [0, 0]
}

export function compare(g: Entry, t: Entry, identities: Identities): Cell[] {
  if (g.kind === 'champion' && t.kind === 'champion') {
    const gc = g.champion
    const tc = t.champion
    const gi = identities[gc.identity]
    const ti = identities[tc.identity]
    return [
      eq('gender', gi?.gender, ti?.gender),
      eq('species', gi?.species, ti?.species),
      { column: 'range', value: isMelee(gc) ? 'melee' : 'ranged', status: isMelee(gc) === isMelee(tc) ? 'ok' : 'no' },
      eq('damageType', gc.damageType, tc.damageType),
      eq('role', gc.role, tc.role),
      num('cost', gc.cost, tc.cost),
      overlap('traits', traitNames(g.set, gc.traits), traitNames(t.set, tc.traits)),
      setCell(g, t, gc.identity === tc.identity),
      eq('region', gi?.region, ti?.region),
    ]
  }
  if (g.kind === 'item' && t.kind === 'item') {
    const gi = g.item
    const ti = t.item
    const gFirst = g.sets[0]
    const tFirst = t.sets[0]
    const first: Cell =
      gFirst.id === tFirst.id
        ? { column: 'firstSet', value: gFirst.id, status: 'ok' }
        : { column: 'firstSet', value: gFirst.id, status: 'no', arrow: tFirst.number > gFirst.number ? 'up' : 'down' }
    return [
      eq('kind', gi.kind, ti.kind),
      overlap('recipe', itemNames(g.set, gi.recipe), itemNames(t.set, ti.recipe)),
      overlap('stats', gi.stats, ti.stats),
      first,
      num('setCount', g.sets.length, t.sets.length),
      { column: 'unique', value: gi.unique, status: gi.unique === ti.unique ? 'ok' : 'no' },
    ]
  }
  if (g.kind === 'trait' && t.kind === 'trait') {
    const gt = g.trait
    const tt = t.trait
    const [gLo, gHi] = memberCosts(g.set, gt)
    const [tLo, tHi] = memberCosts(t.set, tt)
    const costStatus: CellStatus = gLo === tLo && gHi === tHi ? 'ok' : gLo <= tHi && tLo <= gHi ? 'part' : 'no'
    return [
      setCell(g, t, normalizeAnswer(gt.name) === normalizeAnswer(tt.name)),
      num('champions', gt.championKeys.length, tt.championKeys.length),
      num('tiers', gt.breakpoints.length, tt.breakpoints.length),
      num('firstTier', gt.breakpoints[0] ?? 0, tt.breakpoints[0] ?? 0),
      { column: 'costs', value: `${gLo}-${gHi}`, status: costStatus },
    ]
  }
  throw new Error(`cannot compare ${g.kind} with ${t.kind}`)
}

export const isSolved = (g: Entry, t: Entry) => entryKey(g) === entryKey(t)

/** Autocomplete: prefix matches first, then substring matches; stable order within each group. */
export function searchEntries(entries: Entry[], query: string, limit = 8): Entry[] {
  const q = normalizeAnswer(query)
  if (!q) return []
  const starts: Entry[] = []
  const contains: Entry[] = []
  for (const e of entries) {
    const n = normalizeAnswer(entryName(e))
    if (n.startsWith(q)) starts.push(e)
    else if (n.includes(q)) contains.push(e)
  }
  return [...starts, ...contains].slice(0, limit)
}

// ---- "what you know so far": the best information per column across all guesses

export type Known =
  | { column: string; kind: 'exact'; value: Cell['value'] }
  | { column: string; kind: 'range'; min?: number; max?: number }
  | { column: string; kind: 'partial'; value: Cell['value'] }
  | { column: string; kind: 'unknown' }

const toNumber = (v: Cell['value']) => (typeof v === 'number' ? v : Number(v))

/**
 * Per column: an exact match wins; otherwise arrows narrow a numeric range with exclusive bounds
 * (answer > min, answer < max); otherwise the first partial match; otherwise unknown.
 */
export function knownSoFar(columns: string[], rows: Cell[][]): Known[] {
  return columns.map((column) => {
    const cells = rows.map((r) => r.find((c) => c.column === column)).filter((c): c is Cell => !!c)
    const exact = cells.find((c) => c.status === 'ok')
    if (exact) return { column, kind: 'exact', value: exact.value }
    let min: number | undefined
    let max: number | undefined
    for (const c of cells) {
      if (!c.arrow) continue
      const n = toNumber(c.value)
      if (!Number.isFinite(n)) continue
      if (c.arrow === 'up') min = min === undefined ? n : Math.max(min, n)
      else max = max === undefined ? n : Math.min(max, n)
    }
    if (min !== undefined || max !== undefined) return { column, kind: 'range', min, max }
    const partial = cells.find((c) => c.status === 'part')
    if (partial) return { column, kind: 'partial', value: partial.value }
    return { column, kind: 'unknown' }
  })
}
