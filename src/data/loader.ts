// Loads versioned static data from public/data (design §4.1). Old versions stay published,
// so challenge links and past Dailies can load exactly the data they were made with.
import type { Identities, Latest, Manifest, SetData, SetDetails } from './types'

const BASE = `${import.meta.env.BASE_URL}data`
const cache = new Map<string, Promise<unknown>>()

function getJson<T>(path: string): Promise<T> {
  const url = `${BASE}/${path}`
  let p = cache.get(url)
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`โหลดข้อมูลไม่สำเร็จ (${r.status}) ${path}`)
      return r.json()
    })
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return p as Promise<T>
}

export const loadLatest = () => getJson<Latest>('latest.json')
export const loadManifest = (v: number) => getJson<Manifest>(`v${v}/manifest.json`)
export const loadIdentities = (v: number) => getJson<Identities>(`v${v}/champion-identities.json`)
export const loadSet = (v: number, id: string) => getJson<SetData>(`v${v}/sets/set-${id}.json`)
export const loadDetails = (v: number, id: string) => getJson<SetDetails>(`v${v}/details/set-${id}.json`)

export async function loadSets(v: number, ids: string[]): Promise<SetData[]> {
  return Promise.all(ids.map((id) => loadSet(v, id)))
}

/** Verified set ids of a version, in set order. */
export async function verifiedSetIds(v: number): Promise<string[]> {
  const m = await loadManifest(v)
  return m.sets.filter((s) => s.status === 'verified').map((s) => s.id)
}

/**
 * Resolve the data version to use. A requested version that cannot be loaded falls back to latest,
 * and `fellBack` tells the UI to warn that questions may differ.
 */
export async function resolveVersion(requested?: number): Promise<{ version: number; fellBack: boolean }> {
  const latest = await loadLatest()
  if (!requested || requested === latest.latest) return { version: latest.latest, fellBack: false }
  try {
    await loadManifest(requested)
    return { version: requested, fellBack: false }
  } catch {
    return { version: latest.latest, fellBack: true }
  }
}

/** Data version used for a given day's Daily: pinned in latest.json, else the latest. */
export async function dailyVersion(isoDate: string): Promise<number> {
  const latest = await loadLatest()
  return latest.dailyVersions[isoDate] ?? latest.latest
}
