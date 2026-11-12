// Cross-set identities + hand-maintained tags (design §4.3).
// Sources: TFT data (name, sets), Meraki LoL data (region, role/damage fallback), data-src/champion-tags.json (gender, species, overrides).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DamageType, Gender, Identities, Role, SetData, Species } from '../../src/data/types'
import { DATA_DIR, RAW_DIR } from './fetch'
import { slug } from './normalize'

export const SRC_DIR = join(DATA_DIR, '..', '..', 'data-src')

export interface TagEntry {
  name: string
  gender?: Gender
  species?: Species
  region?: string
  reviewed?: boolean
  /** setId -> role/damage override for sets whose TFT data has no role */
  roleOverrides?: Record<string, { role?: Role; damageType?: DamageType }>
  note?: string
}
export type TagFile = Record<string, TagEntry>

/** identity slug -> canonical identity slug, for units renamed between sets */
export type IdentityAliases = Record<string, string>

export function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback
}

export interface MerakiChampion {
  name: string
  roles?: string[]
  adaptiveType?: string
  faction?: string
}

const MERAKI_ROLE: [RegExp, Role][] = [
  [/^MARKSMAN$/, 'Carry'],
  [/^ASSASSIN$/, 'Reaper'],
  [/^(TANK|VANGUARD|WARDEN)$/, 'Tank'],
  [/^(FIGHTER|JUGGERNAUT|DIVER|SKIRMISHER)$/, 'Fighter'],
  [/^(MAGE|BURST|BATTLEMAGE|ARTILLERY|ENCHANTER|CATCHER|SUPPORT)$/, 'Caster'],
  [/^SPECIALIST$/, 'Specialist'],
]

export function merakiRole(m: MerakiChampion): { role?: Role; damageType?: DamageType } {
  const role = (m.roles ?? []).map((r) => MERAKI_ROLE.find(([re]) => re.test(r))?.[1]).find(Boolean)
  const damageType: DamageType | undefined =
    m.adaptiveType === 'PHYSICAL_DAMAGE' ? 'AD' : m.adaptiveType === 'MAGIC_DAMAGE' ? 'AP' : undefined
  return { role, damageType }
}

const REGION_NAMES: Record<string, string> = {
  bandle_city: 'Bandle City',
  bilgewater: 'Bilgewater',
  demacia: 'Demacia',
  ionia: 'Ionia',
  ixtal: 'Ixtal',
  noxus: 'Noxus',
  piltover: 'Piltover',
  shadow_isles: 'Shadow Isles',
  shurima: 'Shurima',
  mount_targon: 'Targon',
  targon: 'Targon',
  freljord: 'Freljord',
  void: 'Void',
  zaun: 'Zaun',
  runeterra: 'Runeterra',
  unaffiliated: 'Runeterra',
}

export function merakiRegion(m: MerakiChampion): string | undefined {
  if (!m.faction) return undefined
  return REGION_NAMES[m.faction.toLowerCase()] ?? m.faction.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Meraki's full champion map, keyed by slug(name). Downloaded once into raw/. */
export async function loadMeraki(): Promise<Map<string, MerakiChampion>> {
  const dest = join(RAW_DIR, 'meraki-champions.json')
  if (!existsSync(dest)) {
    const res = await fetch('https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json', {
      signal: AbortSignal.timeout(300_000),
    })
    if (!res.ok) throw new Error(`Meraki HTTP ${res.status}`)
    const { writeFileSync } = await import('node:fs')
    writeFileSync(dest, await res.text())
  }
  const all = JSON.parse(readFileSync(dest, 'utf8')) as Record<string, MerakiChampion>
  return new Map(Object.values(all).map((m) => [slug(m.name), m]))
}

/**
 * Apply identity aliases, fill missing role/damage from Meraki or overrides, and build the identity table.
 * Mutates the champion records in `sets`.
 */
export function buildIdentities(
  sets: SetData[],
  tags: TagFile,
  aliases: IdentityAliases,
  meraki: Map<string, MerakiChampion>,
): { identities: Identities; missingMeraki: string[] } {
  const identities: Identities = {}
  const missingMeraki = new Set<string>()
  for (const s of sets) {
    for (const c of s.champions) {
      c.identity = aliases[c.identity] ?? c.identity
      const tag = tags[c.identity]
      const m = meraki.get(c.identity)
      if (!m) missingMeraki.add(c.identity)

      const override = tag?.roleOverrides?.[s.id]
      if (override?.role) c.role = override.role
      if (override?.damageType) c.damageType = override.damageType
      if ((!c.role || !c.damageType) && m) {
        const fb = merakiRole(m)
        c.role ??= fb.role
        c.damageType ??= fb.damageType
      }

      const id = (identities[c.identity] ??= { name: c.name, sets: [], reviewed: false })
      if (!id.sets.includes(s.id)) id.sets.push(s.id)
      id.name = c.name // latest set's spelling wins
      id.gender = tag?.gender
      id.species = tag?.species
      id.region = tag?.region ?? (m ? merakiRegion(m) : undefined)
      id.reviewed = !!tag?.reviewed && !!id.gender && !!id.species && !!id.region
    }
  }
  const sorted = Object.fromEntries(Object.entries(identities).sort(([a], [b]) => a.localeCompare(b)))
  return { identities: sorted, missingMeraki: [...missingMeraki].sort() }
}
