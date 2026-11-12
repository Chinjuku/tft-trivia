// Usage: npx tsx scripts/data/probe.ts 9.21 10.5 ...
// Prints which set mutators each patch contains, with playable champion counts.
import { fetchTftPatch, pool } from './fetch'

type Raw = { setData?: { number: number; mutator: string; name: string; champions: { traits?: string[] }[] }[]; sets?: Record<string, { name: string; champions: { traits?: string[] }[] }> }

const patches = process.argv.slice(2)
await pool(patches, 4, async (p) => {
  const d = (await fetchTftPatch(p)) as Raw
  const rows = d.setData
    ? d.setData.map((s) => `${s.mutator}(${s.number}) "${s.name}" ${s.champions.filter((c) => c.traits?.length).length}`)
    : Object.entries(d.sets ?? {}).map(([n, s]) => `sets[${n}] "${s.name}" ${s.champions.filter((c) => c.traits?.length).length}`)
  console.log(`${p}: ${rows.filter((r) => !r.endsWith(' 0')).join(' | ')}`)
})
