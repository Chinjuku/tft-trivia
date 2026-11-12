// Shared data contract between scripts/data (writer) and the app (reader).
// See docs/superpowers/specs/2026-11-12-tft-trivia-design.md §4.2

export type DamageType = 'AD' | 'AP'
export type Role = 'Tank' | 'Fighter' | 'Caster' | 'Carry' | 'Reaper' | 'Specialist'

export interface Champion {
  /** set-specific key, e.g. "TFT4_Garen" (old sets: "TFT1_Garen" synthesized) */
  key: string
  /** stable cross-set identity, e.g. "garen" */
  identity: string
  name: string
  cost: number
  /** trait keys within the same set */
  traits: string[]
  range: number
  damageType?: DamageType
  role?: Role
  image: string
  icon: string
}

export type TraitType = 'origin' | 'class' | 'unique'

export interface Trait {
  key: string
  name: string
  type?: TraitType
  breakpoints: number[]
  championKeys: string[]
  icon: string
}

export type ItemKind = 'component' | 'completed' | 'emblem' | 'artifact' | 'radiant' | 'support' | 'other'

export interface Item {
  key: string
  name: string
  kind: ItemKind
  recipe?: [string, string]
  stats: string[]
  unique: boolean
  icon: string
}

export interface SetData {
  id: string
  number: number
  name: string
  patch: string
  champions: Champion[]
  traits: Trait[]
  items: Item[]
}

export type SetStatus = 'verified' | 'draft'

export interface ManifestSet {
  id: string
  number: number
  name: string
  patch: string
  status: SetStatus
  counts: { champions: number; items: number; traits: number }
}

export interface Manifest {
  dataVersion: number
  sets: ManifestSet[]
}

export type Gender = 'male' | 'female' | 'other'
export type Species =
  | 'human'
  | 'yordle'
  | 'vastaya'
  | 'void'
  | 'undead'
  | 'darkin'
  | 'celestial'
  | 'dragon'
  | 'construct'
  | 'monster'
  | 'other'

export interface Identity {
  name: string
  gender?: Gender
  species?: Species
  region?: string
  /** League of Legends release year (Meraki); absent for TFT-only units */
  releaseYear?: number
  /** League lanes, e.g. ["TOP","JUNGLE"] (Meraki) */
  positions?: string[]
  /** sets this identity appears in */
  sets: string[]
  reviewed: boolean
}

export type Identities = Record<string, Identity>

export interface Latest {
  latest: number
  /** YYYY-MM-DD (Thai time) -> dataVersion used for that day's Daily */
  dailyVersions: Record<string, number>
}

// ---- data browser details (public/data/v<N>/details/set-<id>.json)

export interface StatBlock {
  hp?: number
  mana?: number
  initialMana?: number
  ad?: number
  attackSpeed?: number
  armor?: number
  mr?: number
  range?: number
  /** percent */
  critChance?: number
}

export interface ChampionDetail {
  ability?: { name: string; desc: string; icon: string }
  stats: StatBlock
}

export interface AugmentDetail {
  key: string
  name: string
  desc: string
  icon: string
  tier?: 'silver' | 'gold' | 'prismatic'
}

export interface SetDetails {
  id: string
  /** by champion key */
  champions: Record<string, ChampionDetail>
  /** by trait key */
  traits: Record<string, { desc: string; tiers: { min: number; text: string }[] }>
  /** by item key */
  items: Record<string, { desc: string }>
  augments: AugmentDetail[]
}
