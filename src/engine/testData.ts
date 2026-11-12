// Test helper: load the committed real data (public/data/v<latest>) from disk.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Identities, Latest, SetData } from '../data/types'

const ROOT = join(__dirname, '..', '..', 'public', 'data')

export function loadRealData(): { sets: SetData[]; identities: Identities; version: number } {
  const latest = JSON.parse(readFileSync(join(ROOT, 'latest.json'), 'utf8')) as Latest
  const dir = join(ROOT, `v${latest.latest}`)
  const sets = readdirSync(join(dir, 'sets')).map((f) => JSON.parse(readFileSync(join(dir, 'sets', f), 'utf8')) as SetData)
  const identities = JSON.parse(readFileSync(join(dir, 'champion-identities.json'), 'utf8')) as Identities
  return { sets, identities, version: latest.latest }
}
