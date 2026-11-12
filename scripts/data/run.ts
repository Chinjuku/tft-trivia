// npm run data [-- --images]
// Fetch -> normalize -> tags -> validate -> write versioned data -> scripts/data/report.md
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SetData } from '../../src/data/types'
import { DATA_DIR, fetchTftPatch, pool } from './fetch'
import { normalizeSet, slug, type RawFile } from './normalize'
import { SETS } from './patches'
import { buildIdentities, loadMeraki, readJson, SRC_DIR, type IdentityAliases, type TagFile } from './tags'
import { validateSet } from './validate'
import { writeVersion } from './write'

type ItemOverrides = Record<string, { exclude?: string[] }>

const checkImages = process.argv.includes('--images')

const sets: SetData[] = []
for (const spec of SETS) {
  const raw = (await fetchTftPatch(spec.patch)) as RawFile
  const d = normalizeSet(raw, spec)
  const excl = new Set((readJson<ItemOverrides>(join(SRC_DIR, 'item-overrides.json'), {})[spec.id]?.exclude ?? []).map(slug))
  d.items = d.items.filter((i) => !excl.has(slug(i.name)))
  sets.push(d)
}

const tags = readJson<TagFile>(join(SRC_DIR, 'champion-tags.json'), {})
const aliases = readJson<IdentityAliases>(join(SRC_DIR, 'identity-aliases.json'), {})
const meraki = await loadMeraki()
const { identities, missingMeraki } = buildIdentities(sets, tags, aliases, meraki)

const errors: string[] = []
const warnings: string[] = []
for (const s of sets) {
  const r = validateSet(s)
  errors.push(...r.errors)
  warnings.push(...r.warnings)
}

const broken: string[] = []
if (checkImages) {
  const urls = [...new Set(sets.flatMap((s) => [...s.champions.flatMap((c) => [c.image, c.icon]), ...s.traits.map((t) => t.icon), ...s.items.map((i) => i.icon)]))]
  console.log(`checking ${urls.length} images…`)
  await pool(urls, 8, async (u) => {
    try {
      const res = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(30_000) })
      if (!res.ok) broken.push(`${res.status} ${u}`)
    } catch (e) {
      broken.push(`ERR ${u} ${(e as Error).message}`)
    }
  })
}

// ---- report
const ids = Object.entries(identities)
const lines: string[] = []
lines.push('# Data report', '', `Generated ${new Date().toISOString()}`, '')
lines.push('| Set | Name | Patch | Champions | Traits | Items (comp/compl/emblem/other) | Champions with role | Status |')
lines.push('|---|---|---|---|---|---|---|---|')
for (const [i, s] of sets.entries()) {
  const k = (kind: string) => s.items.filter((x) => x.kind === kind).length
  const others = s.items.length - k('component') - k('completed') - k('emblem')
  lines.push(
    `| ${s.id} | ${s.name} | ${s.patch} | ${s.champions.length} | ${s.traits.length} | ${s.items.length} (${k('component')}/${k('completed')}/${k('emblem')}/${others}) | ${s.champions.filter((c) => c.role).length}/${s.champions.length} | ${SETS[i].status ?? 'draft'} |`,
  )
}
lines.push('', `## Identities: ${ids.length}`, '')
lines.push(`- reviewed: ${ids.filter(([, v]) => v.reviewed).length}`)
lines.push(`- missing gender/species: ${ids.filter(([, v]) => !v.gender || !v.species).length}`)
lines.push(`- missing region: ${ids.filter(([, v]) => !v.region).length}`)
lines.push(`- not in Meraki (TFT-only or renamed): ${missingMeraki.join(', ') || '—'}`)
lines.push('', `## Errors (${errors.length})`, '', ...errors.map((e) => `- ${e}`))
lines.push('', `## Warnings (${warnings.length})`, '', ...warnings.map((w) => `- ${w}`))
if (checkImages) lines.push('', `## Broken images (${broken.length})`, '', ...broken.sort().map((b) => `- ${b}`))
lines.push('', '## รายละเอียดแต่ละ Set', '')
for (const s of sets) {
  lines.push(`### Set ${s.id} · ${s.name} (แพตช์ ${s.patch})`, '')
  for (let cost = 1; cost <= 7; cost++) {
    const cs = s.champions.filter((c) => c.cost === cost)
    if (cs.length) lines.push(`- **Cost ${cost}** (${cs.length}): ${cs.map((c) => c.name).sort().join(', ')}`)
  }
  lines.push(`- **Traits** (${s.traits.length}): ${s.traits.map((t) => `${t.name} [${t.breakpoints.join('/')}]`).sort().join(', ')}`)
  for (const kind of ['component', 'completed', 'emblem', 'artifact', 'radiant', 'support'] as const) {
    const its = s.items.filter((i) => i.kind === kind)
    if (its.length) lines.push(`- **${kind}** (${its.length}): ${its.map((i) => i.name).sort().join(', ')}`)
  }
  lines.push('')
}
writeFileSync(join(DATA_DIR, 'report.md'), lines.join('\n') + '\n')

if (errors.length) {
  console.error(`✗ ${errors.length} errors — see scripts/data/report.md`)
  for (const e of errors.slice(0, 20)) console.error('  ' + e)
  process.exit(1)
}

const statuses = Object.fromEntries(SETS.map((s) => [s.id, s.status ?? 'draft'] as const))
const { version, created } = writeVersion({ sets, identities, statuses })
console.log(`${created ? '✓ wrote' : '= unchanged'} data v${version} · ${sets.length} sets · ${ids.length} identities · ${warnings.length} warnings`)
