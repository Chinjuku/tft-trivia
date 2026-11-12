// Per-set detail files for the data browser: abilities, base stats, readable descriptions, augments.
// Kept out of set-<id>.json so quiz/guess never download them.
import type { AugmentDetail, ChampionDetail, SetData, SetDetails, StatBlock } from '../../src/data/types'
import { assetUrl, isLocalizedName, slug, type RawFile, type SetSpec } from './normalize'

type Vars = Record<string, number | number[] | null | undefined>

const SCALE_LABEL: Record<string, string> = {
  scaleAP: 'AP',
  scaleAD: 'AD',
  scaleHealth: 'HP',
  scaleArmor: 'Armor',
  scaleMR: 'MR',
  scaleAS: 'AS',
  scaleMana: 'Mana',
  scaleDR: 'DR',
  scaleCrit: 'Crit',
  scaleCritMult: 'Crit DMG',
  scaleDA: 'Amp',
  scaleSV: 'Omnivamp',
}

/** 0.35 -> "0.35", 82 -> "82", 1.234 -> "1.23" */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '?'
  const r = Math.round(n * 100) / 100
  return String(r)
}

/** Ability variables hold one value per star level at indices 1..3; show "a/b/c", or one number when equal. */
function starValues(v: number | number[], mult: number): string {
  if (!Array.isArray(v)) return fmt(v * mult)
  const stars = [v[1], v[2], v[3]].filter((x) => x != null).map((x) => x * mult)
  if (!stars.length) return fmt((v[0] ?? NaN) * mult)
  return stars.every((x) => x === stars[0]) ? fmt(stars[0]) : stars.map(fmt).join('/')
}

function lookup(vars: Vars, name: string): number | number[] | undefined {
  const lower = new Map(Object.entries(vars).map(([k, v]) => [k.toLowerCase(), v]))
  const get = (k: string) => {
    const v = lower.get(k.toLowerCase())
    return v == null ? undefined : v
  }
  // "ModifiedDamage" / "TotalDamage" are computed in game; fall back to the base variable
  return get(name) ?? get(name.replace(/^(Modified|Total|Scaled|Base)/i, '')) ?? undefined
}

/** Replace @Var@ / @Var*100@ placeholders, then turn markup into plain text with line breaks. */
export function renderTemplate(desc: string, vars: Vars): string {
  let s = desc.replace(/@([^@]+)@/g, (_, expr: string) => {
    const m = /^([\w.:]+)(?:\*(\d+(?:\.\d+)?))?$/.exec(expr.trim())
    if (!m) return '?'
    const v = lookup(vars, m[1])
    if (v === undefined) return '?'
    return starValues(v, m[2] ? Number(m[2]) : 1)
  })
  s = s
    .replace(/%i:(\w+)%/g, (_, k: string) => (SCALE_LABEL[k] ? ` ${SCALE_LABEL[k]}` : ''))
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(row|expandRow)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s*\(\s*\)/g, '')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return s
}

interface RawTraitEffect {
  minUnits?: number
  variables?: Vars
}

/** Trait: head text from the first tier's numbers + one line per tier from the row template(s). */
export function renderTrait(desc: string, effects: RawTraitEffect[]): { desc: string; tiers: { min: number; text: string }[] } {
  const rowRe = /<(row|expandRow)>([\s\S]*?)<\/\1>/gi
  const rows = [...desc.matchAll(rowRe)].map((m) => m[2])
  const head = desc.replace(rowRe, '')
  const tierEffects = effects.filter((e) => (e.minUnits ?? 0) > 0 && (e.minUnits ?? 0) < 100)
  const varsOf = (e?: RawTraitEffect): Vars => ({ ...(e?.variables ?? {}), MinUnits: e?.minUnits ?? null })
  const tiers = tierEffects.map((e, i) => {
    const tpl = rows.length === tierEffects.length ? rows[i] : rows[0] ?? ''
    return { min: e.minUnits!, text: renderTemplate(tpl, varsOf(e)).replace(/^\(\d+\)\s*/, '') }
  })
  // "Current Bonus: ?" lines are live in-game counters; they have no static value
  const headText = renderTemplate(head, varsOf(tierEffects[0]))
    .split('\n')
    .filter((line) => !/^current\b/i.test(line.trim()) && !/^[\s?%,.A-Za-z]*\?[\s?%,.A-Za-z]*$/.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { desc: headText, tiers }
}

interface RawAbility {
  name?: string
  desc?: string
  icon?: string
  variables?: { name: string; value: number[] | null }[]
}
interface RawChamp {
  apiName?: string
  name: string
  ability?: RawAbility
  stats?: Record<string, number | null>
}

function stats(s: Record<string, number | null> | undefined): StatBlock {
  const n = (k: string) => (typeof s?.[k] === 'number' ? (s[k] as number) : undefined)
  return {
    hp: n('hp'),
    mana: n('mana'),
    initialMana: n('initialMana'),
    ad: n('damage'),
    attackSpeed: n('attackSpeed') != null ? Math.round(n('attackSpeed')! * 100) / 100 : undefined,
    armor: n('armor'),
    mr: n('magicResist'),
    range: n('range'),
    critChance: n('critChance') != null ? Math.round(n('critChance')! * 100) : undefined,
  }
}

const AUGMENT_TIER: Record<string, AugmentDetail['tier']> = { I: 'silver', II: 'gold', III: 'prismatic' }

/** Silver/Gold/Prismatic from the icon file suffix (_I, _II, _III), when present. */
export function augmentTier(icon: string | undefined): AugmentDetail['tier'] {
  const m = /_(I{1,3})(?:\.[\w]+)*\.(?:dds|tex|png)$/i.exec(icon ?? '')
  return m ? AUGMENT_TIER[m[1].toUpperCase()] : undefined
}

export function buildDetails(raw: RawFile, spec: SetSpec, set: SetData): SetDetails {
  const rs = spec.mutator
    ? raw.setData!.find((s) => s.mutator === spec.mutator)!
    : raw.sets![String(Math.floor(spec.number))]
  const keyPrefix = `TFT${spec.id.replace('.', '_')}`
  const rawChamps = rs.champions as unknown as RawChamp[]

  const champions: Record<string, ChampionDetail> = {}
  for (const c of set.champions) {
    const r = rawChamps.find((x) => (x.apiName ?? `${keyPrefix}_${slug(x.name)}`) === c.key) ?? rawChamps.find((x) => x.name === c.name)
    if (!r) continue
    const vars: Vars = Object.fromEntries((r.ability?.variables ?? []).map((v) => [v.name, v.value]))
    champions[c.key] = {
      ability: r.ability?.name
        ? {
            name: r.ability.name,
            desc: renderTemplate(r.ability.desc ?? '', vars),
            icon: assetUrl(spec.patch, r.ability.icon),
          }
        : undefined,
      stats: stats(r.stats ?? undefined),
    }
  }

  const traits: SetDetails['traits'] = {}
  for (const t of set.traits) {
    const r = rs.traits.find((x) => x.name === t.name) as unknown as { desc?: string; effects?: RawTraitEffect[] } | undefined
    if (!r?.desc) continue
    traits[t.key] = renderTrait(r.desc, r.effects ?? [])
  }

  const items: SetDetails['items'] = {}
  for (const it of set.items) {
    const r = raw.items.find((x) => slug(x.name) === slug(it.name) && (x as { desc?: string }).desc)
    const desc = (r as { desc?: string; effects?: Vars } | undefined)?.desc
    if (!desc) continue
    const effects = (r as { effects?: Vars }).effects
    items[it.key] = { desc: renderTemplate(desc, Array.isArray(effects) ? {} : (effects ?? {})) }
  }

  const augments: AugmentDetail[] = []
  const byApi = new Map(raw.items.filter((i) => i.apiName).map((i) => [i.apiName!, i]))
  const seen = new Set<string>()
  for (const api of (rs as { augments?: string[] }).augments ?? []) {
    const a = byApi.get(api) as (RawFile['items'][number] & { desc?: string; effects?: Vars }) | undefined
    if (!a || !(isLocalizedName(a.name) || /\s/.test(a.name))) continue
    const name = a.name.trim()
    if (seen.has(slug(name))) continue
    seen.add(slug(name))
    augments.push({
      key: api,
      name,
      desc: renderTemplate(a.desc ?? '', Array.isArray(a.effects) ? {} : (a.effects ?? {})),
      icon: assetUrl(spec.patch, a.icon),
      tier: augmentTier(a.icon),
    })
  }
  augments.sort((x, y) => x.name.localeCompare(y.name))

  return { id: set.id, champions, traits, items, augments }
}
