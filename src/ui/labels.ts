// Thai UI labels for engine values. Game names (champions, items, traits) stay in English.
import type { GuessKind } from '../engine/guess'
import type { QuizMode } from '../engine/quiz'

export const MODE_LABEL: Record<QuizMode, { icon: string; label: string; hint: string }> = {
  champion: { icon: '⚔️', label: 'Champion', hint: 'ทายชื่อตัวละคร' },
  item: { icon: '💎', label: 'Item', hint: 'ทายชื่อไอเทม' },
  trait: { icon: '🔮', label: 'Trait', hint: 'ทายชื่อ Trait' },
  set: { icon: '🌌', label: 'Set ไหน?', hint: 'อยู่ Set ไหน' },
}

export const GUESS_LABEL: Record<GuessKind, string> = { champion: 'Champion', item: 'Item', trait: 'Trait' }

export const STYLE_LABEL = { choice: 'ตัวเลือก', typing: 'พิมพ์', mixed: 'ผสม' } as const

export const COLUMN_LABEL: Record<string, string> = {
  gender: 'เพศ',
  species: 'เผ่าพันธุ์',
  range: 'ระยะ',
  damageType: 'AD/AP',
  role: 'บทบาท',
  cost: 'Cost',
  traits: 'Traits',
  set: 'Set',
  region: 'ภูมิภาค',
  kind: 'ประเภท',
  recipe: 'สูตร',
  stats: 'สเตตัส',
  unique: 'ชิ้นเดียว',
  type: 'ประเภท',
  champions: 'จำนวนตัว',
  tiers: 'จำนวนขั้น',
  firstTier: 'ขั้นแรก',
  costs: 'Cost ตัวละคร',
}

const VALUE_LABEL: Record<string, string> = {
  male: 'ชาย',
  female: 'หญิง',
  other: 'อื่นๆ',
  human: 'มนุษย์',
  yordle: 'Yordle',
  vastaya: 'Vastaya',
  void: 'Void',
  undead: 'Undead',
  darkin: 'Darkin',
  celestial: 'Celestial',
  dragon: 'มังกร',
  construct: 'จักรกล',
  monster: 'สัตว์ประหลาด',
  melee: 'ประชิด',
  ranged: 'ระยะไกล',
  component: 'ชิ้นส่วน',
  completed: 'ไอเทมเต็ม',
  emblem: 'Emblem',
  artifact: 'Artifact',
  radiant: 'Radiant',
  support: 'Support',
  origin: 'Origin',
  class: 'Class',
  unique: 'Unique',
}

export function valueLabel(column: string, v: unknown): string {
  if (v == null || v === '') return '?'
  if (typeof v === 'boolean') return v ? 'ใช่' : 'ไม่'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
  if (column === 'set') return `Set ${v}`
  return VALUE_LABEL[String(v)] ?? String(v)
}
