// Dev-only page (design §4.3, plan 3.8): review drafted champion tags and export a new champion-tags.json.
// Not reachable in production builds (route is only registered when import.meta.env.DEV).
import { useMemo, useState } from 'react'
import { loadIdentities, loadLatest, loadManifest, loadSets } from '../../data/loader'
import type { Gender, Species } from '../../data/types'
import { Img } from '../../ui/Img'
import { Button, Card, Chip, ErrorBox, Loading } from '../../ui/kit'
import { useAsync } from '../../ui/useAsync'

interface TagEntry {
  name: string
  gender?: Gender
  species?: Species
  region?: string
  reviewed?: boolean
  note?: string
  roleOverrides?: unknown
}
type TagFile = Record<string, TagEntry>

const GENDERS: Gender[] = ['male', 'female', 'other']
const SPECIES: Species[] = ['human', 'yordle', 'vastaya', 'void', 'undead', 'darkin', 'celestial', 'dragon', 'construct', 'monster', 'other']
const REGIONS = [
  'Bandle City',
  'Bilgewater',
  'Demacia',
  'Freljord',
  'Ionia',
  'Ixtal',
  'Noxus',
  'Piltover',
  'Shadow Isles',
  'Shurima',
  'Targon',
  'Void',
  'Zaun',
  'Runeterra',
  "Summoner's Rift",
  'Other',
]

interface Row {
  id: string
  icon: string
  sets: string[]
  merakiRegion?: string
}

async function loadReview() {
  const latest = await loadLatest()
  const v = latest.latest
  const [manifest, identities, tagsModule] = await Promise.all([
    loadManifest(v),
    loadIdentities(v),
    import('../../../data-src/champion-tags.json'),
  ])
  const sets = await loadSets(v, manifest.sets.map((s) => s.id))
  const iconOf = new Map<string, string>()
  for (const s of [...sets].sort((a, b) => a.number - b.number)) for (const c of s.champions) iconOf.set(c.identity, c.icon || c.image)
  const rows: Row[] = Object.entries(identities).map(([id, x]) => ({ id, icon: iconOf.get(id) ?? '', sets: x.sets, merakiRegion: x.region }))
  return { rows, tags: structuredClone((tagsModule as { default: TagFile }).default) }
}

export default function Review() {
  const state = useAsync(loadReview, [])
  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <ErrorBox error={state.error} />
  return <ReviewView rows={state.value.rows} initial={state.value.tags} />
}

function ReviewView({ rows, initial }: { rows: Row[]; initial: TagFile }) {
  const [tags, setTags] = useState<TagFile>(initial)
  const [filter, setFilter] = useState<'todo' | 'notes' | 'all'>('todo')
  const [q, setQ] = useState('')
  const [dirty, setDirty] = useState(false)

  const patch = (id: string, p: Partial<TagEntry>) => {
    setTags((t) => ({ ...t, [id]: { ...(t[id] ?? { name: id }), ...p } }))
    setDirty(true)
  }
  const reviewedCount = rows.filter((r) => tags[r.id]?.reviewed).length
  const shown = useMemo(
    () =>
      rows
        .filter((r) => (filter === 'todo' ? !tags[r.id]?.reviewed : filter === 'notes' ? !!tags[r.id]?.note : true))
        .filter((r) => !q || r.id.includes(q.toLowerCase().replace(/[^a-z0-9]/g, ''))),
    [rows, tags, filter, q],
  )

  const exportFile = () => {
    const sorted = Object.fromEntries(Object.entries(tags).sort(([a], [b]) => a.localeCompare(b)))
    const blob = new Blob([JSON.stringify(sorted, null, 1) + '\n'], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'champion-tags.json'
    a.click()
    URL.revokeObjectURL(a.href)
    setDirty(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card highlight>
        <b>ตรวจแท็กตัวละคร</b> <span className="text-xs text-muted">(เฉพาะตอน dev)</span>
        <p className="mt-1 text-sm text-muted">
          ตรวจแล้ว {reviewedCount}/{rows.length} ({Math.round((reviewedCount / rows.length) * 100)}%) · ทาย Champion จะเปิดเมื่อถึง 80%
        </p>
        <p className="mt-1 text-xs text-muted">
          กด Export แล้วเอาไฟล์ไปแทน <code>data-src/champion-tags.json</code> จากนั้นรัน <code>npm run data</code>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={exportFile}>Export champion-tags.json{dirty ? ' •' : ''}</Button>
          <Chip on={filter === 'todo'} onClick={() => setFilter('todo')}>
            ยังไม่ตรวจ
          </Chip>
          <Chip on={filter === 'notes'} onClick={() => setFilter('notes')}>
            มีโน้ต
          </Chip>
          <Chip on={filter === 'all'} onClick={() => setFilter('all')}>
            ทั้งหมด
          </Chip>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา"
            className="w-28 rounded-md border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-gold"
          />
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        {shown.map((r) => {
          const t = tags[r.id] ?? { name: r.id }
          return (
            <div key={r.id} className={`flex flex-wrap items-center gap-2 rounded-lg border p-2 ${t.reviewed ? 'border-ok/60' : 'border-line'} bg-card`}>
              <Img src={r.icon} name={t.name} className="h-10 w-10 rounded" />
              <div className="w-32 min-w-0">
                <div className="truncate text-sm font-semibold">{t.name}</div>
                <div className="truncate text-[10px] text-muted">Set {r.sets.join(', ')}</div>
              </div>
              <select value={t.gender ?? ''} onChange={(e) => patch(r.id, { gender: e.target.value as Gender })} className="rounded border border-line bg-bg px-1 py-1 text-xs">
                <option value="">เพศ?</option>
                {GENDERS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
              <select value={t.species ?? ''} onChange={(e) => patch(r.id, { species: e.target.value as Species })} className="rounded border border-line bg-bg px-1 py-1 text-xs">
                <option value="">เผ่า?</option>
                {SPECIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                value={t.region ?? ''}
                onChange={(e) => patch(r.id, { region: e.target.value || undefined })}
                className="rounded border border-line bg-bg px-1 py-1 text-xs"
              >
                <option value="">{r.merakiRegion ? `${r.merakiRegion} (Meraki)` : 'ภูมิภาค?'}</option>
                {REGIONS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              {t.note && <span className="text-[11px] text-part brightness-150">📝 {t.note}</span>}
              <Button
                variant={t.reviewed ? 'plain' : 'ghost'}
                className="ml-auto !px-3 !py-1 text-xs"
                disabled={!t.gender || !t.species || !(t.region || r.merakiRegion)}
                onClick={() => patch(r.id, { reviewed: !t.reviewed })}
              >
                {t.reviewed ? '✓ ตรวจแล้ว' : 'ยืนยัน'}
              </Button>
            </div>
          )
        })}
        {!shown.length && <p className="py-8 text-center text-muted">ไม่มีรายการ</p>}
      </div>
    </div>
  )
}
