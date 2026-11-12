// Data browser: everything we know about a set — champions (stats + ability), traits, items, augments.
// Every card opens a popup; the open popup lives in the URL (?o=c:KEY) so it is shareable and Back closes it.
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { loadDetails, loadIdentities, loadLatest, loadManifest, loadSet } from '../../data/loader'
import type { AugmentDetail, Champion, Identities, Item, ManifestSet, SetData, SetDetails, Trait } from '../../data/types'
import { normalizeAnswer } from '../../engine/answer'
import { Img } from '../../ui/Img'
import { BackButton, Chip, ErrorBox, Loading } from '../../ui/kit'
import { valueLabel } from '../../ui/labels'
import { Modal } from '../../ui/Modal'
import { useAsync } from '../../ui/useAsync'

type Tab = 'champions' | 'traits' | 'items' | 'augments'
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'champions', icon: '⚔️', label: 'Champions' },
  { id: 'traits', icon: '🔮', label: 'Traits' },
  { id: 'items', icon: '💎', label: 'Items' },
  { id: 'augments', icon: '✨', label: 'Augments' },
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
const KIND_ORDER: Item['kind'][] = ['component', 'completed', 'emblem', 'artifact', 'radiant', 'support', 'other']

/** what is open: c = champion, t = trait, i = item, a = augment */
type OpenRef = { type: 'c' | 't' | 'i' | 'a'; key: string }
const parseOpen = (s: string | null): OpenRef | null => {
  const m = /^([ctia]):(.+)$/.exec(s ?? '')
  return m ? { type: m[1] as OpenRef['type'], key: m[2] } : null
}

interface Loaded {
  sets: ManifestSet[]
  set: SetData
  details: SetDetails
  identities: Identities
}

interface Ctx {
  set: SetData
  details: SetDetails
  identities: Identities
  open: (ref: OpenRef) => void
}

const matches = (q: string, ...texts: (string | undefined)[]) => {
  const n = normalizeAnswer(q)
  return !n || texts.some((t) => t && normalizeAnswer(t).includes(n))
}

export function Browse() {
  const [search, setSearch] = useSearchParams()
  const setParam = search.get('s')
  const tab = (TABS.some((t) => t.id === search.get('t')) ? search.get('t') : 'champions') as Tab
  const q = search.get('q') ?? ''
  const openRef = parseOpen(search.get('o'))

  const state = useAsync<Loaded>(async () => {
    const v = (await loadLatest()).latest
    const m = await loadManifest(v)
    const sets = m.sets.filter((s) => s.status === 'verified').sort((a, b) => a.number - b.number)
    const id = sets.some((s) => s.id === setParam) ? setParam! : sets[sets.length - 1].id
    const [set, details, identities] = await Promise.all([loadSet(v, id), loadDetails(v, id), loadIdentities(v)])
    return { sets, set, details, identities }
  }, [setParam])

  /** replace = filters/tabs (no history entry); push = opening a popup (Back closes it) */
  const update = (patch: Record<string, string | null>, push = false) => {
    const next = new URLSearchParams(search)
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setSearch(next, { replace: !push })
  }

  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <ErrorBox error={state.error} />
  const { sets, set, details, identities } = state.value
  const ctx: Ctx = { set, details, identities, open: (ref) => update({ o: `${ref.type}:${ref.key}` }, true) }
  const counts: Record<Tab, number> = {
    champions: set.champions.length,
    traits: set.traits.length,
    items: set.items.length,
    augments: details.augments.length,
  }

  return (
    <div className="flex flex-col gap-4">
      <BackButton />
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">
          Set {set.id} <span className="text-gold">{set.name}</span>
        </h1>
        <p className="text-xs text-muted">ข้อมูลจากแพตช์ {set.patch} · ตัวเลขสกิลแสดงเป็น 1★/2★/3★ · กดการ์ดเพื่อดูรายละเอียด</p>
      </div>

      {/* sets: one scrollable row on phones, wraps from sm up */}
      <div className="-mx-4 flex gap-1.5 scroll-row overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {sets.map((s) => (
          <span key={s.id} className="shrink-0">
            <Chip on={s.id === set.id} onClick={() => update({ s: s.id, o: null })} title={s.name}>
              {s.id}
            </Chip>
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="grid grid-cols-4 gap-1.5 lg:flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => update({ t: t.id })}
              className={`flex flex-col items-center rounded-lg border px-2 py-1.5 text-xs transition sm:flex-row sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm ${
                tab === t.id ? 'border-gold bg-gold-dim text-gold' : 'border-line hover:border-muted'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              <span className="text-[10px] text-muted sm:text-xs">{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder="ค้นหาชื่อหรือคำในคำอธิบาย…"
          className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-gold lg:ml-auto lg:w-72"
        />
      </div>

      {tab === 'champions' && <ChampionsTab ctx={ctx} q={q} />}
      {tab === 'traits' && <TraitsTab ctx={ctx} q={q} />}
      {tab === 'items' && <ItemsTab ctx={ctx} q={q} />}
      {tab === 'augments' && <AugmentsTab ctx={ctx} q={q} />}

      <DetailModal ctx={ctx} openRef={openRef} onClose={() => update({ o: null })} />
    </div>
  )
}

// ---------------------------------------------------------------- shared bits

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex items-center gap-1.5 scroll-row overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      <span className="mr-1 shrink-0 text-xs text-muted">{label}</span>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="py-8 text-center text-muted">ไม่พบ</p>
}

function Stat({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="rounded-md border border-line bg-bg px-2 py-1.5 text-center">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="truncate font-semibold">{value ?? '—'}</div>
    </div>
  )
}

function Pill({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const cls = 'flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-sm'
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:border-gold`}>
      {children}
    </button>
  ) : (
    <span className={cls}>{children}</span>
  )
}

const cardBtn = 'rounded-xl border border-line bg-card p-3 text-left transition hover:border-gold'

// ---------------------------------------------------------------- tabs

function ChampionsTab({ ctx, q }: { ctx: Ctx; q: string }) {
  const { set, details } = ctx
  const [cost, setCost] = useState<number | null>(null)
  const traitName = (k: string) => set.traits.find((t) => t.key === k)?.name ?? k
  const list = useMemo(
    () =>
      [...set.champions]
        .filter((c) => cost == null || c.cost === cost)
        .filter((c) =>
          matches(q, c.name, ...c.traits.map(traitName), details.champions[c.key]?.ability?.name, details.champions[c.key]?.ability?.desc),
        )
        .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [set, details, q, cost],
  )
  const costs = [...new Set(set.champions.map((c) => c.cost))].sort((a, b) => a - b)
  return (
    <div className="flex flex-col gap-3">
      <FilterRow label="Cost">
        <Chip on={cost == null} onClick={() => setCost(null)}>
          ทั้งหมด
        </Chip>
        {costs.map((c) => (
          <Chip key={c} on={cost === c} onClick={() => setCost(cost === c ? null : c)}>
            {c}
          </Chip>
        ))}
      </FilterRow>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {list.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => ctx.open({ type: 'c', key: c.key })}
            className={`overflow-hidden rounded-lg border-2 bg-card text-left transition hover:brightness-125 ${costTone(c.cost)}`}
          >
            <Img src={c.image} name={c.name} className="aspect-[4/3] w-full" />
            <div className="p-2">
              <div className="flex items-center justify-between gap-1">
                <b className="truncate">{c.name}</b>
                <span className="shrink-0 text-xs text-gold">{c.cost}🪙</span>
              </div>
              <div className="truncate text-xs text-muted">{c.traits.map(traitName).join(' · ')}</div>
            </div>
          </button>
        ))}
      </div>
      {!list.length && <Empty />}
    </div>
  )
}

function TraitsTab({ ctx, q }: { ctx: Ctx; q: string }) {
  const { set, details } = ctx
  const champ = (k: string) => set.champions.find((c) => c.key === k)
  const list = [...set.traits]
    .filter((t) => matches(q, t.name, details.traits[t.key]?.desc, ...t.championKeys.map((k) => champ(k)?.name)))
    .sort((a, b) => a.name.localeCompare(b.name))
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => (
          <button key={t.key} type="button" onClick={() => ctx.open({ type: 't', key: t.key })} className={cardBtn}>
            <div className="flex items-center gap-2">
              <Img src={t.icon} name={t.name} className="h-9 w-9 shrink-0 rounded bg-black/30 p-1" />
              <b className="truncate">{t.name}</b>
              <span className="ml-auto shrink-0 text-xs text-muted">{t.breakpoints.join(' / ')}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-text/80">{details.traits[t.key]?.desc}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {t.championKeys
                .map(champ)
                .filter((c): c is Champion => !!c)
                .sort((a, b) => a.cost - b.cost)
                .map((c) => (
                  <Img key={c.key} src={c.icon} name={c.name} className={`h-7 w-7 rounded border-2 ${costTone(c.cost)}`} />
                ))}
            </div>
          </button>
        ))}
      </div>
      {!list.length && <Empty />}
    </>
  )
}

function ItemsTab({ ctx, q }: { ctx: Ctx; q: string }) {
  const { set, details } = ctx
  const [kind, setKind] = useState<Item['kind'] | null>(null)
  const byKey = new Map(set.items.map((i) => [i.key, i]))
  const kinds = KIND_ORDER.filter((k) => set.items.some((i) => i.kind === k))
  const list = set.items
    .filter((i) => kind == null || i.kind === kind)
    .filter((i) => matches(q, i.name, details.items[i.key]?.desc, ...i.stats, ...(i.recipe ?? []).map((k) => byKey.get(k)?.name)))
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name))
  return (
    <div className="flex flex-col gap-3">
      <FilterRow label="ประเภท">
        <Chip on={kind == null} onClick={() => setKind(null)}>
          ทั้งหมด
        </Chip>
        {kinds.map((k) => (
          <Chip key={k} on={kind === k} onClick={() => setKind(kind === k ? null : k)}>
            {valueLabel('kind', k)}
          </Chip>
        ))}
      </FilterRow>
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {list.map((i) => (
          <button key={i.key} type="button" onClick={() => ctx.open({ type: 'i', key: i.key })} className={cardBtn}>
            <div className="flex items-center gap-3">
              <Img src={i.icon} name={i.name} className="h-11 w-11 shrink-0 rounded-md" />
              <div className="min-w-0">
                <b className="block truncate">{i.name}</b>
                <span className="text-[11px] text-muted">
                  {valueLabel('kind', i.kind)}
                  {i.stats.length ? ` · ${i.stats.join(', ')}` : ''}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
      {!list.length && <Empty />}
    </div>
  )
}

function AugmentsTab({ ctx, q }: { ctx: Ctx; q: string }) {
  const augments = ctx.details.augments
  const [tier, setTier] = useState<string | null>(null)
  if (!augments.length) return <p className="py-8 text-center text-muted">Set นี้ยังไม่มี Augment (Augment เริ่มมีตั้งแต่ Set 6)</p>
  const tiers = ['silver', 'gold', 'prismatic'].filter((t) => augments.some((a) => a.tier === t))
  const list = augments.filter((a) => (tier == null || a.tier === tier) && matches(q, a.name, a.desc))
  return (
    <div className="flex flex-col gap-3">
      {tiers.length > 0 && (
        <FilterRow label="ระดับ">
          <Chip on={tier == null} onClick={() => setTier(null)}>
            ทั้งหมด
          </Chip>
          {tiers.map((t) => (
            <Chip key={t} on={tier === t} onClick={() => setTier(tier === t ? null : t)}>
              {TIER_LABEL[t]}
            </Chip>
          ))}
        </FilterRow>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <button key={a.key} type="button" onClick={() => ctx.open({ type: 'a', key: a.key })} className={cardBtn}>
            <div className="flex items-center gap-3">
              <Img src={a.icon} name={a.name} className="h-11 w-11 shrink-0 rounded-md" />
              <div className="min-w-0">
                <b className="block truncate">{a.name}</b>
                {a.tier && <span className={`rounded border px-1.5 text-[11px] ${TIER_TONE[a.tier]}`}>{TIER_LABEL[a.tier]}</span>}
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-text/80">{a.desc}</p>
          </button>
        ))}
      </div>
      {!list.length && <Empty />}
    </div>
  )
}

// ---------------------------------------------------------------- popups

function DetailModal({ ctx, openRef, onClose }: { ctx: Ctx; openRef: OpenRef | null; onClose: () => void }) {
  const { set, details } = ctx
  if (!openRef) return null
  if (openRef.type === 'c') {
    const c = set.champions.find((x) => x.key === openRef.key)
    return c ? <ChampionPopup ctx={ctx} c={c} onClose={onClose} /> : null
  }
  if (openRef.type === 't') {
    const t = set.traits.find((x) => x.key === openRef.key)
    return t ? <TraitPopup ctx={ctx} t={t} onClose={onClose} /> : null
  }
  if (openRef.type === 'i') {
    const i = set.items.find((x) => x.key === openRef.key)
    return i ? <ItemPopup ctx={ctx} i={i} onClose={onClose} /> : null
  }
  const a = details.augments.find((x) => x.key === openRef.key)
  return a ? <AugmentPopup a={a} onClose={onClose} /> : null
}

function ChampionPopup({ ctx, c, onClose }: { ctx: Ctx; c: Champion; onClose: () => void }) {
  const { set, details, identities } = ctx
  const d = details.champions[c.key]
  const id = identities[c.identity]
  const traits = c.traits.map((k) => set.traits.find((t) => t.key === k)).filter((t): t is Trait => !!t)
  const st = d?.stats ?? {}
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      hero={<Img src={c.image} name={c.name} className="aspect-[16/8] w-full sm:aspect-[16/7]" />}
      title={
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          {c.name}
          <span className="text-base font-normal text-gold">
            {c.cost} Cost · Set {set.id}
          </span>
        </span>
      }
    >
      <div className="flex flex-wrap gap-2">
        {traits.map((t) => (
          <Pill key={t.key} onClick={() => ctx.open({ type: 't', key: t.key })}>
            <Img src={t.icon} name={t.name} className="h-5 w-5 rounded bg-black/30" />
            {t.name}
          </Pill>
        ))}
        {c.damageType && <Pill>{c.damageType}</Pill>}
        {c.role && <Pill>{c.role}</Pill>}
        <Pill>{valueLabel('range', c.range <= 1 ? 'melee' : 'ranged')}</Pill>
      </div>

      {d?.ability && (
        <section className="rounded-lg border border-gold/30 bg-gold-dim p-3">
          <div className="mb-2 flex items-center gap-2">
            <Img src={d.ability.icon} name={d.ability.name} className="h-10 w-10 shrink-0 rounded" />
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
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
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
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="เพศ" value={valueLabel('gender', id.gender)} />
          <Stat label="เผ่าพันธุ์" value={valueLabel('species', id.species)} />
          <Stat label="ภูมิภาค" value={id.region} />
          <Stat label="ออกใน LoL" value={id.releaseYear} />
          <Stat label="เลน" value={id.positions?.length ? valueLabel('position', id.positions) : undefined} />
          <Stat label="จำนวน Set" value={id.sets.length} />
        </section>
      )}
      {id && <p className="text-xs text-muted">อยู่ใน Set: {id.sets.join(', ')}</p>}
    </Modal>
  )
}

function TraitPopup({ ctx, t, onClose }: { ctx: Ctx; t: Trait; onClose: () => void }) {
  const { set, details } = ctx
  const d = details.traits[t.key]
  const members = t.championKeys
    .map((k) => set.champions.find((c) => c.key === k))
    .filter((c): c is Champion => !!c)
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-3">
          <Img src={t.icon} name={t.name} className="h-10 w-10 shrink-0 rounded bg-black/30 p-1" />
          {t.name}
        </span>
      }
    >
      {d?.desc && <p className="whitespace-pre-line text-sm leading-relaxed">{d.desc}</p>}
      {!!d?.tiers.length && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {d.tiers.map((tier) => (
            <li key={tier.min} className="flex gap-2 rounded-md border border-line bg-bg p-2">
              <span className="w-8 shrink-0 text-center font-bold text-gold">{tier.min}</span>
              <span className="whitespace-pre-line">{tier.text}</span>
            </li>
          ))}
        </ul>
      )}
      <section>
        <div className="mb-2 text-sm text-muted">ตัวละคร ({members.length})</div>
        <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-5">
          {members.map((c) => (
            <button key={c.key} type="button" onClick={() => ctx.open({ type: 'c', key: c.key })} className="flex flex-col items-center gap-1 text-xs">
              <Img src={c.icon} name={c.name} className={`h-12 w-12 rounded-md border-2 ${costTone(c.cost)}`} />
              <span className="w-full truncate text-center">{c.name}</span>
            </button>
          ))}
        </div>
      </section>
    </Modal>
  )
}

function ItemPopup({ ctx, i, onClose }: { ctx: Ctx; i: Item; onClose: () => void }) {
  const { set, details } = ctx
  const byKey = new Map(set.items.map((x) => [x.key, x]))
  const parts = (i.recipe ?? []).map((k) => byKey.get(k)).filter((x): x is Item => !!x)
  const usedIn = set.items.filter((x) => x.recipe?.includes(i.key)).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-3">
          <Img src={i.icon} name={i.name} className="h-12 w-12 shrink-0 rounded-md" />
          <span>
            {i.name}
            <span className="block text-sm font-normal text-muted">{valueLabel('kind', i.kind)}</span>
          </span>
        </span>
      }
    >
      {(i.stats.length > 0 || i.unique) && (
        <div className="flex flex-wrap gap-1.5">
          {i.stats.map((s) => (
            <Pill key={s}>{s}</Pill>
          ))}
          {i.unique && <span className="rounded-md border border-gold/50 px-2 py-1 text-sm text-gold">Unique</span>}
        </div>
      )}
      {details.items[i.key]?.desc && <p className="whitespace-pre-line text-sm leading-relaxed">{details.items[i.key].desc}</p>}
      {parts.length > 0 && (
        <section>
          <div className="mb-2 text-sm text-muted">สูตร</div>
          <div className="flex flex-wrap items-center gap-2">
            {parts.map((p, n) => (
              <span key={n} className="flex items-center gap-2">
                {n > 0 && <span className="text-muted">+</span>}
                <Pill onClick={() => ctx.open({ type: 'i', key: p.key })}>
                  <Img src={p.icon} name={p.name} className="h-7 w-7 rounded" />
                  {p.name}
                </Pill>
              </span>
            ))}
          </div>
        </section>
      )}
      {usedIn.length > 0 && (
        <section>
          <div className="mb-2 text-sm text-muted">ใช้ทำ ({usedIn.length})</div>
          <div className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">
            {usedIn.map((x) => (
              <Pill key={x.key} onClick={() => ctx.open({ type: 'i', key: x.key })}>
                <Img src={x.icon} name={x.name} className="h-7 w-7 shrink-0 rounded" />
                <span className="truncate">{x.name}</span>
              </Pill>
            ))}
          </div>
        </section>
      )}
    </Modal>
  )
}

function AugmentPopup({ a, onClose }: { a: AugmentDetail; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-3">
          <Img src={a.icon} name={a.name} className="h-12 w-12 shrink-0 rounded-md" />
          <span>
            {a.name}
            {a.tier && <span className={`mt-1 block w-fit rounded border px-1.5 text-xs font-normal ${TIER_TONE[a.tier]}`}>{TIER_LABEL[a.tier]}</span>}
          </span>
        </span>
      }
    >
      <p className="whitespace-pre-line text-sm leading-relaxed">{a.desc || '—'}</p>
    </Modal>
  )
}
