import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DATA_DIR = dirname(fileURLToPath(import.meta.url))
export const RAW_DIR = join(DATA_DIR, 'raw')
export const CDRAGON = 'https://raw.communitydragon.org'

async function download(url: string, dest: string, retries = 3): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(300_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      const text = await res.text()
      JSON.parse(text) // ensure the file is complete before caching it
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, text)
      return
    } catch (err) {
      if (attempt >= retries) throw err
      console.warn(`retry ${attempt} ${url}: ${(err as Error).message}`)
    }
  }
}

/** Download (or read from cache) the CommunityDragon TFT file for one patch. */
export async function fetchTftPatch(patch: string): Promise<unknown> {
  const dest = join(RAW_DIR, `${patch}.json`)
  if (!existsSync(dest)) {
    console.log(`fetch tft ${patch}`)
    await download(`${CDRAGON}/${patch}/cdragon/tft/en_us.json`, dest)
  }
  return JSON.parse(readFileSync(dest, 'utf8'))
}

/** Download (or read from cache) Meraki's LoL champion file. Returns null if it does not exist. */
export async function fetchMerakiChampion(name: string): Promise<unknown | null> {
  const dest = join(RAW_DIR, 'meraki', `${name}.json`)
  const missing = join(RAW_DIR, 'meraki', `${name}.missing`)
  if (existsSync(missing)) return null
  if (!existsSync(dest)) {
    const url = `https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions/${name}.json`
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
    if (res.status === 404 || res.status === 403) {
      mkdirSync(dirname(missing), { recursive: true })
      writeFileSync(missing, '')
      return null
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, await res.text())
  }
  return JSON.parse(readFileSync(dest, 'utf8'))
}

/** Run async tasks with a concurrency limit. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return out
}
