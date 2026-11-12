import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import type { SetData } from '../../src/data/types'
import { writeVersion, type Output } from './write'

const set: SetData = { id: '1', number: 1, name: 'A', patch: '9.21', champions: [], traits: [], items: [] }
const out = (name = 'A'): Output => ({ sets: [{ ...set, name }], identities: {}, statuses: { '1': 'draft' } })

test('creates v1, skips identical content, creates v2 on change and keeps v1', () => {
  const root = mkdtempSync(join(tmpdir(), 'tft-data-'))
  expect(writeVersion(out(), root)).toEqual({ version: 1, created: true })
  expect(writeVersion(out(), root)).toEqual({ version: 1, created: false })
  expect(writeVersion(out('B'), root)).toEqual({ version: 2, created: true })
  expect(existsSync(join(root, 'v1', 'sets', 'set-1.json'))).toBe(true)
  const latest = JSON.parse(readFileSync(join(root, 'latest.json'), 'utf8'))
  expect(latest).toEqual({ latest: 2, dailyVersions: {} })
  const m = JSON.parse(readFileSync(join(root, 'v2', 'manifest.json'), 'utf8'))
  expect(m.sets[0]).toMatchObject({ id: '1', name: 'B', status: 'draft' })
})
