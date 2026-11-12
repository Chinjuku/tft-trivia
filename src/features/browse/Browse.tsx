// Data browser: everything we know about a set — champions (stats + ability), traits, items, augments.
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { loadDetails, loadIdentities, loadLatest, loadManifest, loadSet } from '../../data/loader'
import type { AugmentDetail, Champion, Identities, Item, ManifestSet, SetData, SetDetails, Trait } from '../../data/types'
import { normalizeAnswer } from '../../engine/answer'
import { Img } from '../../ui/Img'
import { BackButton, Card, Chip, ErrorBox, Loading } from '../../ui/kit'
import { valueLabel } from '../../ui/labels'
import { useAsync } from '../../ui/useAsync'

type Tab = 'champions' | 'traits' | 'items' | 'augments'
const TABS: { id: Tab; label: string }[] = [
  { id: 'champions', label: '⚔️ Champions' },
  { id: 'traits', label: '🔮 Traits' },
  { id: 'items', label: '💎 Items' },
  { id: 'augments', label: '✨ Augments' },
]

const COST_TONE: Record<number, string> = {
  1: 'border-[#8a8f98]',
  2: 'border-[#1fae5b]',
  3: 'border-[#2f80ed]',
  4: 'border-[#a64dd8]',
  5: 'border-gold',
}
const costTone = (c: number) => COST_TONE[c] ?? 'border-[#e0475b]'

const TIER_TONE: Record<string, string> = {
  silver: 'border-[#a8b3c2] text-[#c9d3df]',
  gold: 'border-gold text-gold',
  prismatic: 'border-[#c08cff] text-[#d8b8ff]',
}
const TIER_LABEL: Record<string, string> = { silver: 'Silver', gold: 'Gold', prismatic: 'Prismatic' }

interface Loaded {
  version: number
  sets: ManifestSet[]
  set: SetData
  details: SetDetails
  identities: Identities
}

export function Browse() {
  const [search, setSearch] = useSearchParams()
  const setParam = search.get('s')
  const tab = (TABS.some((t) => t.id === search.get('t')) ? search.get('t') : 'champions') as Tab
  const q = search.get('q') ?? ''

  const state = useAsync<Loaded>(async () => {
    const v = (await loadLatest()).latest
    const m = await loadManifest(v)
    const sets = m.sets.filter((s) => s.status === 'verified').sort((a, b) => a.number - b.number)
    const id = sets.some((s) => s.id === setParam) ? setParam! : sets[sets.length - 1].id
    const [set, details, identities] = await Promise.all([loadSet(v, id), loadDetails(v, id), loadIdentities(v)])
    return { version: v, sets, set, details, identities }
  }, [setParam])

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(search)
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setSearch(next, { replace: true })
  }

  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <ErrorBox error={state.error} />
  const { sets, set, details, identities } = state.value

  return (
    <div className="flex flex-col gap-4">
      <BackButton />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">
            Set {set.id} <span className="text-gold">{set.name}</span>
          </h1>
          <p className="text-xs text-muted">ข้อมูลจากแพตช์ {set.patch} · ตัวเลขสกิลแสดงเป็น 1★/2★/3★</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sets.map((s) => (
          <Chip key={s.id} on={s.id === set.id} onClick={() => update({ s: s.id })} title={s.name}>
            {s.id}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => update({ t: t.id })}
            className={`rounded-lg border px-3 py-2 text-sm transition ${tab === t.id ? 'border-gold bg-gold-dim text-gold' : 'border-line hover:border-muted'}`}
          >
            {t.label}
            <span className="ml-1 text-xs text-muted">
              {t.id === 'champions'
                ? set.champions.length
                : t.id === 'traits'
                  ? set.traits.length
                  : t.id === 'items'
                    ? set.items.length
                    : details.augments.length}
            </span>
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder="ค้นหาชื่อหรือคำในคำอธิบาย…"
          className="ml-auto w-full rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-gold sm:w-72"
        />
      </div>

      {tab === 'champions' && <ChampionsTab set={set} details={details} identities={identities} q={q} />}
      {tab === 'traits' && <TraitsTab set={set} details={details} q={q} onChampion={(name) => update({ t: 'champions', q: name })} />}
      {tab === 'items' && <ItemsTab set={set} details={details} q={q} />}
      {tab === 'augments' && <AugmentsTab augments={details.augments} q={q} />}
    </div>
  )
}

const matches = (q: string, ...texts: (string | undefined)[]) => {
  const n = normalizeAnswer(q)
  return !n || texts.some((t) => t && normalizeAnswer(t).includes(n))
}

// ---------------------------------------------------------------- champions

function ChampionsTab({ set, details, identities, q }: { set: SetData; details: SetDetails; identities: Identities; q: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const [cost, setCost] = useState<number | null>(null)
  const traitName = (k: string) => set.traits.find((t) => t.key === k)?.name ?? k
  const list = useMemo(
    () =>
      [...set.champions]
        .filter((c) => cost == null || c.cost === cost)
        .filter((c) => matches(q, c.name, ...c.traits.map(traitName), details.champions[c.key]?.ability?.name, details.champions[c.key]?.ability?.desc))
        .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [set, details, q, cost],
  )
  const costs = [...new Set(set.champions.map((c) => c.cost))].sort((a, b) => a - b)
  const selected = set.champions.find((c) => c.key === open)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted">Cost</span>
        <Chip on={cost == null} onClick={() => setCost(null)}>
          ทั้งหมด
        </Chip>
        {costs.map((c) => (
          <Chip key={c} on={cost === c} onClick={() => setCost(cost === c ? null : c)}>
            {c}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {list.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setOpen(c.key)}
            className={`overflow-hidden rounded-lg border-2 bg-card text-left transition hover:brightness-125 ${costTone(c.cost)}`}
          >
            <Img src={c.image} name={c.name} className="aspect-[4/3] w-full" />
            <div className="p-2">
              <div className="flex items-center justify-between">
                <b className="truncate">{c.name}</b>
                <span className="text-xs text-gold">{c.cost}🪙</span>
              </div>
              <div className="truncate text-xs text-muted">{c.traits.map(traitName).join(' · ')}</div>
            </div>
          </button>
        ))}
      </div>
      {!list.length && <p className="py-8 text-center text-muted">ไม่พบ</p>}
      {selected && (
        <ChampionModal champion={selected} set={set} details={details} identities={identities} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="rounded-md border border-line bg-bg px-2 py-1.5 text-center">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="font-semibold">{value ?? '—'}</div>
    </div>
  )
}

function ChampionModal({
  champion: c,
  set,
  details,
  identities,
  onClose,
}: {
  champion: Champion
  set: SetData
  details: SetDetails
  identities: Identities
  onClose: () => void
}) {
  const d = details.champions[c.key]
  const id = identities[c.identity]
  const traits = c.traits.map((k) => set.traits.find((t) => t.key === k)).filter((t): t is Trait => !!t)
  const st = d?.stats ?? {}
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-card sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <Img src={c.image} name={c.name} className="aspect-[16/7] w-full" />
          <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm hover:bg-black/80">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-bold">{c.name}</h2>
            <span className="text-gold">
              {c.cost} Cost · Set {set.id}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {traits.map((t) => (
              <span key={t.key} className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-sm">
                <Img src={t.icon} name={t.name} className="h-5 w-5 rounded bg-black/30" />
                {t.name}
              </span>
            ))}
            {c.damageType && <span className="rounded-md border border-line px-2 py-1 text-sm">{c.damageType}</span>}
            {c.role && <span className="rounded-md border border-line px-2 py-1 text-sm">{c.role}</span>}
            <span className="rounded-md border border-line px-2 py-1 text-sm">{valueLabel('range', c.range <= 1 ? 'melee' : 'ranged')}</span>
          </div>

          {d?.ability && (
            <section className="rounded-lg border border-gold/30 bg-gold-dim p-3">
              <div className="mb-2 flex items-center gap-2">
                <Img src={d.ability.icon} name={d.ability.name} className="h-10 w-10 rounded" />
                <div>
                  <div className="text-xs text-muted">สกิล</div>
                  <b className="text-gold">{d.ability.name}</b>
                </div>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed">{d.ability.desc}</p>
            </section>
          )}

          <section>
            <div className="mb-2 text-sm text-muted">สเตตัสพื้นฐาน (1★)</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              <Stat label="HP" value={st.hp} />
              <Stat label="Mana" value={st.mana != null ? `${st.initialMana ?? 0}/${st.mana}` : undefined} />
              <Stat label="AD" value={st.ad} />
              <Stat label="AS" value={st.attackSpeed} />
              <Stat label="Armor" value={st.armor} />
              <Stat label="MR" value={st.mr} />
              <Stat label="Range" value={st.range} />
              <Stat label="Crit" value={st.critChance != null ? `${st.critChance}%` : undefined} />
            </div>
          </section>

          {id && (
            <section className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <Stat label="เพศ" value={valueLabel('gender', id.gender)} />
              <Stat label="เผ่าพันธุ์" value={valueLabel('species', id.species)} />
              <Stat label="ภูมิภาค" value={id.region} />
              <Stat label="ออกใน LoL" value={id.releaseYear} />
              <Stat label="เลน" value={id.positions?.length ? valueLabel('position', id.positions) : undefined} />
              <Stat label="อยู่ใน Set" value={id.sets.join(', ')} />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- traits

function TraitsTab({ set, details, q, onChampion }: { set: SetData; details: SetDetails; q: string; onChampion: (name: string) => void }) {
  const champ = (k: string) => set.champions.find((c) => c.key === k)
  const list = [...set.traits]
    .filter((t) => matches(q, t.name, details.traits[t.key]?.desc, ...t.championKeys.map((k) => champ(k)?.name)))
    .sort((a, b) => a.name.localeCompare(b.name))
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {list.map((t) => {
        const d = details.traits[t.key]
        return (
          <Card key={t.key}>
            <div className="mb-2 flex items-center gap-2">
              <Img src={t.icon} name={t.name} className="h-9 w-9 rounded bg-black/30 p-1" />
              <b className="text-lg">{t.name}</b>
              <span className="ml-auto text-xs text-muted">{t.breakpoints.join(' / ')}</span>
            </div>
            {d?.desc && <p className="whitespace-pre-line text-sm text-text/90">{d.desc}</p>}
            {!!d?.tiers.length && (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {d.tiers.map((tier) => (
                  <li key={tier.min} className="flex gap-2">
                    <span className="w-8 shrink-0 rounded bg-bg text-center text-gold">{tier.min}</span>
                    <span className="whitespace-pre-line">{tier.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {t.championKeys
                .map(champ)
                .filter((c): c is Champion => !!c)
                .sort((a, b) => a.cost - b.cost)
                .map((c) => (
                  <button key={c.key} type="button" title={`${c.name} · ${c.cost} Cost`} onClick={() => onChampion(c.name)}>
                    <Img src={c.icon} name={c.name} className={`h-9 w-9 rounded border-2 ${costTone(c.cost)}`} />
                  </button>
                ))}
            </div>
          </Card>
        )
      })}
      {!list.length && <p className="py-8 text-center text-muted">ไม่พบ</p>}
    </div>
  )
}

// ---------------------------------------------------------------- items

const KIND_ORDER: Item['kind'][] = ['component', 'completed', 'emblem', 'artifact', 'radiant', 'support', 'other']

function ItemsTab({ set, details, q }: { set: SetData; details: SetDetails; q: string }) {
  const [kind, setKind] = useState<Item['kind'] | null>(null)
  const byKey = new Map(set.items.map((i) => [i.key, i]))
  const kinds = KIND_ORDER.filter((k) => set.items.some((i) => i.kind === k))
  const list = set.items
    .filter((i) => kind == null || i.kind === kind)
    .filter((i) => matches(q, i.name, details.items[i.key]?.desc, ...i.stats, ...(i.recipe ?? []).map((k) => byKey.get(k)?.name)))
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted">ประเภท</span>
        <Chip on={kind == null} onClick={() => setKind(null)}>
          ทั้งหมด
        </Chip>
        {kinds.map((k) => (
          <Chip key={k} on={kind === k} onClick={() => setKind(kind === k ? null : k)}>
            {valueLabel('kind', k)}
          </Chip>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((i) => (
          <Card key={i.key} className="!p-3">
            <div className="flex items-start gap-3">
              <Img src={i.icon} name={i.name} className="h-12 w-12 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <b className="truncate">{i.name}</b>
                  <span className="shrink-0 text-[11px] text-muted">{valueLabel('kind', i.kind)}</span>
                </div>
                {i.recipe && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted">
                    {i.recipe.map((k, n) => {
                      const part = byKey.get(k)
                      return (
                        <span key={n} className="flex items-center gap-1">
                          {n > 0 && '+'}
                          <Img src={part?.icon ?? ''} name={part?.name ?? k} className="h-6 w-6 rounded" />
                        </span>
                      )
                    })}
                  </div>
                )}
                {!!i.stats.length && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {i.stats.map((s) => (
                      <span key={s} className="rounded border border-line px-1.5 text-[11px]">
                        {s}
                      </span>
                    ))}
                    {i.unique && <span className="rounded border border-gold/50 px-1.5 text-[11px] text-gold">Unique</span>}
                  </div>
                )}
              </div>
            </div>
            {details.items[i.key]?.desc && <p className="mt-2 whitespace-pre-line text-sm text-text/85">{details.items[i.key].desc}</p>}
          </Card>
        ))}
      </div>
      {!list.length && <p className="py-8 text-center text-muted">ไม่พบ</p>}
    </div>
  )
}

// ---------------------------------------------------------------- augments

function AugmentsTab({ augments, q }: { augments: AugmentDetail[]; q: string }) {
  const [tier, setTier] = useState<string | null>(null)
  if (!augments.length)
    return (
      <Card>
        <p className="text-muted">Set นี้ยังไม่มี Augment (Augment เริ่มมีตั้งแต่ Set 6)</p>
      </Card>
    )
  const tiers = ['silver', 'gold', 'prismatic'].filter((t) => augments.some((a) => a.tier === t))
  const list = augments.filter((a) => (tier == null || a.tier === tier) && matches(q, a.name, a.desc))
  return (
    <div className="flex flex-col gap-3">
      {tiers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">ระดับ</span>
          <Chip on={tier == null} onClick={() => setTier(null)}>
            ทั้งหมด
          </Chip>
          {tiers.map((t) => (
            <Chip key={t} on={tier === t} onClick={() => setTier(tier === t ? null : t)}>
              {TIER_LABEL[t]}
            </Chip>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <Card key={a.key} className="!p-3">
            <div className="flex items-center gap-3">
              <Img src={a.icon} name={a.name} className="h-12 w-12 shrink-0 rounded-md" />
              <div className="min-w-0">
                <b className="block truncate">{a.name}</b>
                {a.tier && <span className={`rounded border px-1.5 text-[11px] ${TIER_TONE[a.tier]}`}>{TIER_LABEL[a.tier]}</span>}
              </div>
            </div>
            {a.desc && <p className="mt-2 whitespace-pre-line text-sm text-text/85">{a.desc}</p>}
          </Card>
        ))}
      </div>
      {!list.length && <p className="py-8 text-center text-muted">ไม่พบ</p>}
    </div>
  )
}
