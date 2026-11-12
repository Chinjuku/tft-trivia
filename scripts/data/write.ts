// Versioned output (design §4.1): public/data/v<N>/..., never deleting old versions.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Identities, Latest, Manifest, ManifestSet, SetData, SetDetails } from '../../src/data/types'
import { DATA_DIR } from './fetch'

export const PUBLIC_DATA = join(DATA_DIR, '..', '..', 'public', 'data')

export interface Output {
  sets: SetData[]
  identities: Identities
  statuses: Record<string, 'verified' | 'draft'>
  /** browser-only details per set (optional so older callers/tests still work) */
  details?: SetDetails[]
}

/** Stable hash of everything a version contains (excluding the version number itself). */
export function contentHash(out: Output): string {
  const h = createHash('sha256')
  h.update(JSON.stringify(out.sets))
  h.update(JSON.stringify(out.identities))
  h.update(JSON.stringify(out.statuses))
  if (out.details) h.update(JSON.stringify(out.details))
  return h.digest('hex').slice(0, 16)
}

export function readLatest(root = PUBLIC_DATA): Latest | null {
  const p = join(root, 'latest.json')
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Latest) : null
}

/** Writes a new version only when content changed. Returns the version now current. */
export function writeVersion(out: Output, root = PUBLIC_DATA): { version: number; created: boolean } {
  const hash = contentHash(out)
  const latest = readLatest(root)
  if (latest) {
    const prev = JSON.parse(readFileSync(join(root, `v${latest.latest}`, 'manifest.json'), 'utf8')) as Manifest & {
      contentHash?: string
    }
    if (prev.contentHash === hash) return { version: latest.latest, created: false }
  }
  const version = (latest?.latest ?? 0) + 1
  const dir = join(root, `v${version}`)
  mkdirSync(join(dir, 'sets'), { recursive: true })

  const manifestSets: ManifestSet[] = out.sets.map((s) => ({
    id: s.id,
    number: s.number,
    name: s.name,
    patch: s.patch,
    status: out.statuses[s.id] ?? 'draft',
    counts: { champions: s.champions.length, items: s.items.length, traits: s.traits.length },
  }))
  const manifest = { dataVersion: version, contentHash: hash, sets: manifestSets }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n')
  writeFileSync(join(dir, 'champion-identities.json'), JSON.stringify(out.identities) + '\n')
  for (const s of out.sets) writeFileSync(join(dir, 'sets', `set-${s.id}.json`), JSON.stringify(s) + '\n')
  if (out.details) {
    mkdirSync(join(dir, 'details'), { recursive: true })
    for (const d of out.details) writeFileSync(join(dir, 'details', `set-${d.id}.json`), JSON.stringify(d) + '\n')
  }

  const next: Latest = { latest: version, dailyVersions: latest?.dailyVersions ?? {} }
  writeFileSync(join(root, 'latest.json'), JSON.stringify(next, null, 1) + '\n')
  return { version, created: true }
}
