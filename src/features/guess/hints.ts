// Hover hints for guess-board columns: what the column means and which values exist in the loaded sets.
import type { Identities, SetData } from '../../data/types'
import type { GuessKind } from '../../engine/guess'
import { valueLabel } from '../../ui/labels'

export interface ColumnHint {
  about: string
  /** possible values (categorical) */
  values?: string[]
  /** span of a numeric column */
  range?: string
}

const ABOUT: Record<string, string> = {
  gender: 'เพศของตัวละคร',
  species: 'เผ่าพันธุ์ / ชนิดของตัวละคร',
  region: 'ภูมิภาคใน Runeterra ที่ตัวละครมาจาก',
  range: 'ระยะโจมตีใน TFT: ประชิด (1 ช่อง) หรือระยะไกล',
  damageType: 'สายดาเมจหลัก: AD (กายภาพ) หรือ AP (เวท)',
  role: 'บทบาทใน Set นั้น',
  cost: 'ราคาตัวละครใน Set นั้น · ↑↓ บอกว่าคำตอบแพงหรือถูกกว่า',
  traits: 'Trait ใน Set นั้น · เหลือง = มี Trait ตรงกันบางตัว',
  set: 'Set ของตัวที่ทาย · เหลือง = ตัวละครเดียวกันแต่คนละ Set · ↑↓ = Set ใหม่หรือเก่ากว่า',
  debut: 'Set แรกที่ตัวละครนี้เคยปรากฏใน TFT',
  appearances: 'จำนวน Set ที่ปรากฏ (นับจาก Set ที่เลือกเล่น)',
  releaseYear: 'ปีที่ตัวละครออกใน League of Legends · "?" = ตัวที่มีแค่ใน TFT',
  position: 'เลนที่เล่นใน LoL · เหลือง = มีเลนตรงกันบางเลน',
  kind: 'ประเภทไอเทม',
  recipe: 'ชิ้นส่วนที่ใช้รวม · เหลือง = มีชิ้นส่วนตรงกัน 1 ชิ้น',
  stats: 'สเตตัสที่ไอเทมให้ · เหลือง = มีบางตัวตรงกัน',
  firstSet: 'Set แรกที่ไอเทมนี้ปรากฏ',
  setCount: 'จำนวน Set ที่มีไอเทมนี้',
  unique: 'ใส่ได้ชิ้นเดียวต่อตัวหรือไม่',
  champions: 'จำนวนตัวละครที่มี Trait นี้',
  tiers: 'จำนวนขั้นของ Trait',
  firstTier: 'จำนวนตัวที่ต้องใช้เปิดขั้นแรก',
  costs: 'ช่วงราคาของตัวละครใน Trait · เหลือง = ช่วงซ้อนกัน',
}

const uniq = (xs: (string | undefined | null)[]) => [...new Set(xs.filter((x): x is string => !!x))]
const span = (ns: number[]) => {
  const v = ns.filter(Number.isFinite)
  return v.length ? `${Math.min(...v)} – ${Math.max(...v)}` : undefined
}

export function buildHints(kind: GuessKind, sets: SetData[], identities: Identities): Record<string, ColumnHint> {
  const champs = sets.flatMap((s) => s.champions)
  const ids = uniq(champs.map((c) => c.identity)).map((k) => identities[k]).filter(Boolean)
  const items = sets.flatMap((s) => s.items)
  const traits = sets.flatMap((s) => s.traits)
  const setNums = sets.map((s) => s.number)
  const label = (col: string, vs: string[]) => vs.map((v) => valueLabel(col, v)).sort((a, b) => a.localeCompare(b))

  const values: Record<string, Omit<ColumnHint, 'about'>> = {}
  if (kind === 'champion') {
    values.gender = { values: label('gender', uniq(ids.map((i) => i.gender))) }
    values.species = { values: label('species', uniq(ids.map((i) => i.species))) }
    values.region = { values: label('region', uniq(ids.map((i) => i.region))) }
    values.range = { values: label('range', ['melee', 'ranged']) }
    values.damageType = { values: uniq(champs.map((c) => c.damageType)).sort() }
    values.role = { values: uniq(champs.map((c) => c.role)).sort() }
    values.cost = { range: span(champs.map((c) => c.cost)) }
    values.set = { range: span(setNums) }
    values.debut = { range: span(setNums) }
    values.appearances = { range: span(ids.map((i) => i.sets.length)) }
    values.releaseYear = { range: span(ids.map((i) => i.releaseYear ?? NaN)) }
    values.position = { values: label('position', uniq(ids.flatMap((i) => i.positions ?? []))) }
  }
  if (kind === 'item') {
    values.kind = { values: label('kind', uniq(items.map((i) => i.kind))) }
    values.stats = { values: uniq(items.flatMap((i) => i.stats)).sort() }
    values.firstSet = { range: span(setNums) }
    values.unique = { values: ['ใช่', 'ไม่'] }
  }
  if (kind === 'trait') {
    values.set = { range: span(setNums) }
    values.champions = { range: span(traits.map((t) => t.championKeys.length)) }
    values.tiers = { range: span(traits.map((t) => t.breakpoints.length)) }
    values.firstTier = { range: span(traits.map((t) => t.breakpoints[0] ?? NaN)) }
    values.costs = { range: span(champs.map((c) => c.cost)) }
  }
  return Object.fromEntries(Object.keys(ABOUT).map((c) => [c, { about: ABOUT[c], ...values[c] }]))
}
