import { HINT_COST, HINT_UNLOCK_AT, type GuessHint } from '../../engine/hints'
import { Img } from '../../ui/Img'
import { COLUMN_LABEL, valueLabel } from '../../ui/labels'
import { CellValue, type IconLookup } from './cells'

export interface OpenedHint {
  hint: GuessHint
  /** for a 'reveal' hint: the column shown (null = nothing left to reveal) */
  reveal: { column: string; value: unknown } | null
}

function HintBody({ o, iconOf }: { o: OpenedHint; iconOf: IconLookup }) {
  const h = o.hint
  switch (h.type) {
    case 'trait':
    case 'part':
    case 'member':
      return (
        <span className="flex items-center gap-2">
          <Img src={h.icon} name={h.name} className="h-7 w-7 max-w-none rounded bg-black/30 p-0.5" />
          <span>
            <span className="text-muted">{h.type === 'trait' ? 'มี Trait' : h.type === 'part' ? 'มีชิ้นส่วน' : 'มีตัวละคร'} </span>
            <b>{h.name}</b>
          </span>
        </span>
      )
    case 'text':
      return (
        <span>
          <span className="text-muted">{h.label}: </span>
          <b>{valueLabel(h.label === 'ประเภท' ? 'kind' : h.label, h.value)}</b>
        </span>
      )
    case 'reveal':
      return o.reveal ? (
        <span className="flex items-center gap-2">
          <span className="text-muted">{COLUMN_LABEL[o.reveal.column]}:</span>
          <b className="flex items-center">
            <CellValue column={o.reveal.column} value={o.reveal.value as never} iconOf={iconOf} />
          </b>
        </span>
      ) : (
        <span className="text-muted">คุณรู้ครบทุกคอลัมน์แล้ว</span>
      )
    case 'image':
      return (
        <span className="flex items-center gap-2">
          <span className="text-muted">ภาพเบลอ</span>
          <span className="overflow-hidden rounded-md border border-line">
            <Img src={h.src} name="?" className="h-16 w-16 max-w-none scale-110 blur-[6px]" />
          </span>
        </span>
      )
  }
}

/** Three hints that unlock with guesses; each opened hint costs a guess. */
export function HintPanel({
  hints,
  opened,
  unlocked,
  onOpen,
  iconOf,
}: {
  hints: GuessHint[]
  opened: OpenedHint[]
  unlocked: number
  onOpen: (i: number) => void
  iconOf: IconLookup
}) {
  if (!hints.length) return null
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">💡 Hint (+{HINT_COST} ครั้ง/อัน)</span>
        {hints.map((_, i) => {
          const isOpen = i < opened.length
          const canOpen = i === opened.length && i < unlocked
          return (
            <button
              key={i}
              type="button"
              disabled={!canOpen}
              onClick={() => onOpen(i)}
              title={isOpen ? 'เปิดแล้ว' : canOpen ? 'เปิด Hint นี้' : `ปลดล็อกเมื่อทายครบ ${HINT_UNLOCK_AT[i]} ครั้ง`}
              className={`rounded-md border px-2.5 py-1 text-xs transition ${
                isOpen
                  ? 'border-gold/40 text-gold/70'
                  : canOpen
                    ? 'border-gold bg-gold-dim text-gold hover:brightness-125'
                    : 'border-line text-muted/60'
              }`}
            >
              {isOpen ? `✓ Hint ${i + 1}` : canOpen ? `เปิด Hint ${i + 1}` : `🔒 ${HINT_UNLOCK_AT[i]} ครั้ง`}
            </button>
          )
        })}
      </div>
      {opened.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {opened.map((o, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold-dim px-3 py-2 text-sm">
              <span className="text-xs text-gold">#{i + 1}</span>
              <HintBody o={o} iconOf={iconOf} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
