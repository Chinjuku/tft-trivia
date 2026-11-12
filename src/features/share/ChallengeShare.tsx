import { useState } from 'react'
import { challengeUrl, type Challenge, type DistributiveOmit } from '../../engine/link'
import { getNick, saveNick } from '../../lib/storage'
import { Button } from '../../ui/kit'

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Asks for a nickname once, then copies the challenge link. */
export function ChallengeShare({ challenge }: { challenge: DistributiveOmit<Challenge, 'nick'> }) {
  const [nick, setNick] = useState(getNick)
  const [editing, setEditing] = useState(!getNick())
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle')
  const url = challengeUrl(`${location.origin}${location.pathname}`, { ...challenge, nick } as Challenge)

  const doCopy = async () => {
    if (!nick.trim()) {
      setEditing(true)
      return
    }
    saveNick(nick)
    setEditing(false)
    setStatus((await copy(url)) ? 'copied' : 'manual')
  }

  return (
    <div className="flex flex-col gap-2">
      {editing && (
        <input
          value={nick}
          maxLength={20}
          onChange={(e) => setNick(e.target.value)}
          placeholder="ชื่อเล่นที่เพื่อนจะเห็น"
          className="rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-gold"
        />
      )}
      <Button onClick={doCopy} disabled={editing && !nick.trim()}>
        {status === 'copied' ? 'คัดลอกลิงก์แล้ว ✓' : 'คัดลอกลิงก์ท้าเพื่อน'}
      </Button>
      {!editing && nick && (
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-muted underline">
          ท้าในชื่อ "{nick}" · เปลี่ยนชื่อ
        </button>
      )}
      {status === 'manual' && (
        <input readOnly value={url} onFocus={(e) => e.target.select()} className="rounded-lg border border-line bg-bg px-3 py-2 text-xs" />
      )}
    </div>
  )
}

export function CopyTextButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState<boolean | null>(null)
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={async () => setDone(await copy(text))}>{done ? 'คัดลอกแล้ว ✓' : label}</Button>
      {done === false && <textarea readOnly value={text} rows={3} className="rounded-lg border border-line bg-bg p-2 text-xs" />}
    </div>
  )
}
