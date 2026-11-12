// Zod shape checks + data-quality rules (design §4.4). Errors stop the run; warnings go to the report.
import { z } from 'zod'
import type { SetData } from '../../src/data/types'

const url = z.string().regex(/^https:\/\//)

const ChampionZ = z.object({
  key: z.string().min(1),
  identity: z.string().regex(/^[a-z0-9]+$/),
  name: z.string().min(1),
  cost: z.number().int().min(1).max(10),
  traits: z.array(z.string()).min(1),
  range: z.number().min(0),
  damageType: z.enum(['AD', 'AP']).optional(),
  role: z.enum(['Tank', 'Fighter', 'Caster', 'Carry', 'Reaper', 'Specialist']).optional(),
  image: url,
  icon: url,
})

const TraitZ = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['origin', 'class', 'unique']).optional(),
  breakpoints: z.array(z.number().int().positive()),
  championKeys: z.array(z.string()).min(1),
  icon: url,
})

const ItemZ = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['component', 'completed', 'emblem', 'artifact', 'radiant', 'support', 'other']),
  recipe: z.tuple([z.string(), z.string()]).optional(),
  stats: z.array(z.string()),
  unique: z.boolean(),
  icon: url,
})

export const SetDataZ = z.object({
  id: z.string(),
  number: z.number(),
  name: z.string().min(1),
  patch: z.string(),
  champions: z.array(ChampionZ),
  traits: z.array(TraitZ),
  items: z.array(ItemZ),
})

export const CHAMPION_RANGE: [number, number] = [45, 110]

export interface ValidationResult {
  errors: string[]
  warnings: string[]
}

export function validateSet(d: SetData): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const parsed = SetDataZ.safeParse(d)
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 20)) errors.push(`Set ${d.id}: ${issue.path.join('.')} ${issue.message}`)
  }

  const traitKeys = new Set(d.traits.map((t) => t.key))
  for (const c of d.champions) {
    for (const t of c.traits) if (!traitKeys.has(t)) errors.push(`Set ${d.id}: ${c.name} -> unknown trait ${t}`)
  }

  const dupes = (names: string[]) => names.filter((n, i) => names.indexOf(n) !== i)
  for (const n of dupes(d.champions.map((c) => c.name))) errors.push(`Set ${d.id}: duplicate champion name ${n}`)
  for (const n of dupes(d.items.map((i) => i.name))) errors.push(`Set ${d.id}: duplicate item name ${n}`)
  for (const n of dupes(d.champions.map((c) => c.key))) errors.push(`Set ${d.id}: duplicate champion key ${n}`)

  const itemKeys = new Set(d.items.map((i) => i.key))
  for (const i of d.items) {
    for (const r of i.recipe ?? []) if (!itemKeys.has(r)) warnings.push(`Set ${d.id}: ${i.name} recipe part ${r} not in set`)
  }

  const [lo, hi] = CHAMPION_RANGE
  if (d.champions.length < lo || d.champions.length > hi)
    errors.push(`Set ${d.id}: ${d.champions.length} champions, expected ${lo}-${hi}`)
  if (d.traits.length < 10) errors.push(`Set ${d.id}: only ${d.traits.length} traits`)
  const components = d.items.filter((i) => i.kind === 'component').length
  if (components < 8) warnings.push(`Set ${d.id}: only ${components} components`)
  if (d.items.filter((i) => i.kind === 'completed').length < 30) warnings.push(`Set ${d.id}: few completed items`)
  for (const c of d.champions) if (c.range === 0) warnings.push(`Set ${d.id}: ${c.name} has range 0`)

  return { errors, warnings }
}
