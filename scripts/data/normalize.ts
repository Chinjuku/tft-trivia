// Turn one CommunityDragon TFT patch file into our SetData shape.
// Handles three eras: `sets` only (9.x–10.11), `setData` without per-set items (10.18–~13.x),
// and `setData` with per-set item lists (newer).
import type { Champion, DamageType, Item, ItemKind, Role, SetData, Trait } from '../../src/data/types'
import { CDRAGON } from './fetch'

export interface SetSpec {
  id: string
  number: number
  name: string
  patch: string
  /** setData mutator to read; omit for old files that only have `sets` */
  mutator?: string
  status?: 'verified' | 'draft'
}

interface RawChampion {
  apiName?: string
  name: string
  cost: number
  traits?: string[]
  icon?: string
  squareIcon?: string
  tileIcon?: string
  role?: string | null
  stats?: { range?: number | null }
}
interface RawTrait {
  apiName?: string
  name: string
  icon?: string
  effects?: { minUnits?: number }[]
}
interface RawItem {
  apiName?: string
  id?: number | null
  name: string
  icon?: string
  from?: number[] | null
  composition?: string[]
  effects?: Record<string, unknown> | unknown[]
  unique?: boolean
}
interface RawSet {
  number?: number
  mutator?: string
  name?: string
  champions: RawChampion[]
  traits: RawTrait[]
  items?: string[]
}
export interface RawFile {
  items: RawItem[]
  sets?: Record<string, RawSet>
  setData?: RawSet[]
}

/** Highest cost a buyable champion has had; anything above is a special unit. */
export const MAX_SHOP_COST = 7

export const COMPONENT_NAMES = new Set([
  'bfsword',
  'recurvebow',
  'needlesslylargerod',
  'tearofthegoddess',
  'chainvest',
  'negatroncloak',
  'giantsbelt',
  'sparringgloves',
  'spatula',
  'fryingpan',
])

/** lowercase a-z0-9 only; used for identities, matching and dedupe */
export function slug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** CommunityDragon asset path -> pinned PNG url. Pinning to the patch keeps removed assets reachable. */
export function assetUrl(patch: string, path: string | undefined | null): string {
  if (!path) return ''
  const p = path.toLowerCase().replace(/\.(dds|tex)$/, '.png')
  return `${CDRAGON}/${patch}/game/${p}`
}

/** Strip markup and @Var@ placeholders from descriptions. */
export function cleanText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/@[^@]*@/g, '')
    .replace(/%i:[a-zA-Z]+%/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A name that is still an untranslated key (e.g. "tft_item_name_Hush") is not usable. */
export function isLocalizedName(name: string): boolean {
  if (!name) return false
  if (/^(tft|game_)/i.test(name)) return false
  if (/_/.test(name)) return false
  if (/[@{}]/.test(name)) return false
  return true
}

const ROLE_WORDS: [RegExp, Role][] = [
  [/tank/i, 'Tank'],
  [/fighter/i, 'Fighter'],
  [/reaper|assassin/i, 'Reaper'],
  [/carry|marksman/i, 'Carry'],
  [/caster/i, 'Caster'],
  [/specialist/i, 'Specialist'],
]

export function parseRole(raw: string | null | undefined): { damageType?: DamageType; role?: Role } {
  if (!raw) return {}
  const damageType: DamageType | undefined = /^AD/.test(raw) ? 'AD' : /^AP/.test(raw) ? 'AP' : undefined
  const role = ROLE_WORDS.find(([re]) => re.test(raw))?.[1]
  return { damageType, role }
}

function pickRawSet(raw: RawFile, spec: SetSpec): RawSet {
  if (spec.mutator) {
    const found = raw.setData?.find((s) => s.mutator === spec.mutator)
    if (!found) throw new Error(`Set ${spec.id}: mutator ${spec.mutator} not in patch ${spec.patch}`)
    return found
  }
  const found = raw.sets?.[String(Math.floor(spec.number))]
  if (!found) throw new Error(`Set ${spec.id}: sets[${Math.floor(spec.number)}] not in patch ${spec.patch}`)
  return found
}

const STAT_KEYS: [RegExp, string][] = [
  [/^(AD|BonusAD)$/, 'AD'],
  [/^(AP|BonusAP)$/, 'AP'],
  [/^(AS|BonusAS)$/, 'AS'],
  [/^Armor$/, 'Armor'],
  [/^MagicResist$/, 'MR'],
  [/^(Health|BonusHealth|BonusHP)$/, 'HP'],
  [/^Mana$/, 'Mana'],
  [/^CritChance$/, 'Crit'],
]

function itemStats(effects: RawItem['effects']): string[] {
  if (!effects || Array.isArray(effects)) return []
  const out = new Set<string>()
  for (const [k, v] of Object.entries(effects)) {
    if (typeof v !== 'number' || v === 0) continue
    const hit = STAT_KEYS.find(([re]) => re.test(k))
    if (hit) out.add(hit[1])
  }
  return [...out].sort()
}

function classifyItem(it: RawItem, recipe: string[] | undefined, componentKeys: Set<string>): ItemKind {
  const api = it.apiName ?? ''
  const nm = slug(it.name)
  if (/radiant/i.test(api) || /^radiant/.test(nm)) return 'radiant'
  if (/emblem/i.test(api) || /emblem$/.test(nm)) return 'emblem'
  if (/artifact|ornn/i.test(api)) return 'artifact'
  if (/support/i.test(api)) return 'support'
  if (COMPONENT_NAMES.has(nm) && (!recipe || recipe.length === 0)) return 'component'
  if (recipe && recipe.length === 2 && recipe.every((r) => componentKeys.has(r))) return 'completed'
  return 'other'
}

/** Set number an asset path is tagged with (e.g. "TFT3_Item_x", "x.TFT_Set4.dds"), if any. */
export function iconSetMarker(icon: string | undefined): number | undefined {
  if (!icon) return undefined
  const m = /TFT(\d{1,2})_/i.exec(icon) ?? /Set(\d{1,2})(?!\d)/i.exec(icon)
  return m ? Number(m[1]) : undefined
}

/**
 * Old patch files keep earlier sets' items in the global list, often sharing the same numeric id
 * (e.g. id 38 = Aspect of Dusk [Set 4] and Battlecast Plating [Set 3]). Keep the current set's one.
 */
export function dedupeOldEraIds(pool: RawItem[], setNo: number): RawItem[] {
  const withId = pool.filter((i) => !i.apiName && i.id != null)
  const rest = pool.filter((i) => i.apiName || i.id == null)
  const groups = new Map<number, RawItem[]>()
  for (const i of withId) {
    if (i.id! <= 0) continue
    groups.set(i.id!, [...(groups.get(i.id!) ?? []), i])
  }
  const kept: RawItem[] = []
  for (const g of groups.values()) {
    const notOther = g.filter((i) => {
      const m = iconSetMarker(i.icon)
      return m === undefined || m === setNo
    })
    const own = notOther.filter((i) => iconSetMarker(i.icon) === setNo)
    const pick = own.length ? own : notOther
    if (pick.length) kept.push(pick[0])
  }
  return [...kept, ...rest]
}

export function normalizeSet(raw: RawFile, spec: SetSpec): SetData {
  const rs = pickRawSet(raw, spec)
  const setNo = Math.floor(spec.number)
  const keyPrefix = `TFT${spec.id.replace('.', '_')}`

  // ---- traits
  const traitByName = new Map<string, Trait>()
  for (const t of rs.traits) {
    if (!isLocalizedName(t.name) && !/\s/.test(t.name)) continue
    const breakpoints = [...new Set((t.effects ?? []).map((e) => e.minUnits ?? 0).filter((n) => n > 0 && n < 100))].sort(
      (a, b) => a - b,
    )
    traitByName.set(t.name, {
      key: t.apiName ?? `${keyPrefix}_${slug(t.name)}`,
      name: t.name,
      breakpoints,
      championKeys: [],
      icon: assetUrl(spec.patch, t.icon),
    })
  }

  // ---- champions
  // Variant units share a name (Set 2 Lux/Qiyana elements, Set 9 Ryze regions, Set 7.5 Nomsy):
  // collapse them into one champion that keeps only the traits all variants share.
  const variants = new Map<string, RawChampion[]>()
  for (const c of rs.champions) {
    if (!c.traits?.length) continue // summons, PvE, dummies
    if (c.cost > MAX_SHOP_COST) continue // special non-shop units (e.g. Set 10 Disco Ball)
    if (!isLocalizedName(c.name) && !/\s/.test(c.name)) continue
    variants.set(c.name, [...(variants.get(c.name) ?? []), c])
  }
  const champions: Champion[] = []
  for (const group of variants.values()) {
    const c = [...group].sort((a, b) => (a.apiName ?? '').localeCompare(b.apiName ?? ''))[0]
    const shared = group.slice(1).reduce((acc, v) => acc.filter((t) => v.traits!.includes(t)), [...c.traits!])
    const traitNames = shared.length ? shared : c.traits!
    const key = c.apiName ?? `${keyPrefix}_${slug(c.name)}`
    const traitKeys: string[] = []
    for (const tn of traitNames) {
      const t = traitByName.get(tn)
      if (!t) continue
      traitKeys.push(t.key)
      t.championKeys.push(key)
    }
    champions.push({
      key,
      identity: slug(c.name),
      name: c.name,
      cost: c.cost,
      traits: traitKeys,
      range: c.stats?.range ?? 0,
      ...parseRole(c.role),
      image: assetUrl(spec.patch, c.icon),
      icon: assetUrl(spec.patch, c.tileIcon ?? c.squareIcon ?? c.icon),
    })
  }
  const traits = [...traitByName.values()].filter((t) => t.championKeys.length > 0)
  for (const t of traits) if (t.breakpoints.length === 1 && t.breakpoints[0] === 1 && t.championKeys.length === 1) t.type = 'unique'

  // ---- items
  const byApi = new Map(raw.items.filter((i) => i.apiName).map((i) => [i.apiName!, i]))
  const byId = new Map(raw.items.filter((i) => i.id != null).map((i) => [i.id!, i]))
  let pool: RawItem[]
  if (rs.items?.length) {
    pool = rs.items.map((a) => byApi.get(a)).filter((i): i is RawItem => !!i)
  } else {
    // global list: standard items + this set's prefixed items; old files have no apiName at all
    const ownPrefix = new RegExp(`^TFT${setNo}_Item_`, 'i')
    pool = raw.items.filter((i) => !i.apiName || /^TFT_Item_/i.test(i.apiName) || ownPrefix.test(i.apiName))
  }
  pool = pool.filter((i) => isLocalizedName(i.name) || /\s/.test(i.name))
  if (!rs.items?.length) pool = dedupeOldEraIds(pool, setNo)

  const keyOf = (i: RawItem) => i.apiName ?? `${keyPrefix}_Item_${slug(i.name)}`
  const recipeOf = (i: RawItem): string[] | undefined => {
    if (i.composition?.length) return i.composition.map((a) => (byApi.get(a) ? keyOf(byApi.get(a)!) : a))
    if (i.from?.length) return i.from.map((id) => byId.get(id)).filter((x): x is RawItem => !!x).map(keyOf)
    return undefined
  }
  const componentKeys = new Set(pool.filter((i) => COMPONENT_NAMES.has(slug(i.name)) && !recipeOf(i)?.length).map(keyOf))

  const items: Item[] = []
  const keptKeyByName = new Map<string, string>()
  const nameByRawKey = new Map(pool.map((i) => [keyOf(i), slug(i.name)]))
  for (const i of pool) {
    const recipe = recipeOf(i)
    const kind = classifyItem(i, recipe, componentKeys)
    if (kind === 'other') continue
    const nameKey = slug(i.name)
    if (keptKeyByName.has(nameKey)) continue
    keptKeyByName.set(nameKey, keyOf(i))
    items.push({
      key: keyOf(i),
      name: i.name.replace(/\s+/g, ' ').replace('B. F.', 'B.F.'),
      kind,
      ...(recipe?.length === 2 ? { recipe: [recipe[0], recipe[1]] as [string, string] } : {}),
      stats: itemStats(i.effects),
      unique: !!i.unique,
      icon: assetUrl(spec.patch, i.icon),
    })
  }

  // Duplicate-named raw items (e.g. two "B.F. Sword" records) collapse into one: point recipes at the kept key.
  const finalKeys = new Set(items.map((i) => i.key))
  for (const it of items) {
    if (!it.recipe) continue
    it.recipe = it.recipe.map((r) => keptKeyByName.get(nameByRawKey.get(r) ?? '') ?? r) as [string, string]
    // e.g. Set 5 "Shadow" component recipes: parts we don't ship -> drop the recipe rather than point nowhere
    if (!it.recipe.every((r) => finalKeys.has(r))) delete it.recipe
  }

  const byKey = (a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key)
  return {
    id: spec.id,
    number: spec.number,
    name: spec.name,
    patch: spec.patch,
    champions: champions.sort(byKey),
    traits: traits.sort(byKey),
    items: items.sort(byKey),
  }
}
