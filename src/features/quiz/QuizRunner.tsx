import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { matchesAnswer, normalizeAnswer } from '../../engine/answer'
import type { Question, QuizMode } from '../../engine/quiz'
import { QUESTION_TIME_MS, questionScore } from '../../engine/score'
import { Button } from '../../ui/kit'
import { Prompt } from './Prompt'
import { questionText } from './questionText'

export interface AnswerRecord {
  given: string | null
  correct: boolean
  ms: number
  points: number
  /** player pressed "give up" on this question */
  skipped?: boolean
}

/** Typed-answer suggestions: names of every subject of that mode in the chosen sets (never hints which one is right). */
export type NameOptions = Partial<Record<QuizMode, string[]>>

function suggest(names: string[], query: string, limit = 8): string[] {
  const q = normalizeAnswer(query)
  if (!q) return []
  const starts: string[] = []
  const contains: string[] = []
  for (const n of names) {
    const k = normalizeAnswer(n)
    if (k.startsWith(q)) starts.push(n)
    else if (k.includes(q)) contains.push(n)
  }
  return [...starts, ...contains].slice(0, limit)
}

export function QuizRunner({
  questions,
  header,
  onDone,
  nameOptions = {},
}: {
  questions: Question[]
  header: string
  onDone: (answers: AnswerRecord[]) => void
  nameOptions?: NameOptions
}) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [revealed, setRevealed] = useState<AnswerRecord | null>(null)
  const [typed, setTyped] = useState('')
  // both set from effects/handlers so render stays pure
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const [hi, setHi] = useState(-1)

  const q = questions[index]
  const suggestions = useMemo(
    () => (q?.style === 'typing' ? suggest(nameOptions[q.mode] ?? [], typed) : []),
    [q, nameOptions, typed],
  )
  const elapsed = startedAt ? now - startedAt : 0
  const remaining = Math.max(0, QUESTION_TIME_MS - elapsed)
  const total = answers.reduce((s, a) => s + a.points, 0)

  const submit = useCallback(
    (given: string | null, skipped = false) => {
      if (revealed) return
      const ms = performance.now() - startedAt
      const correct = !skipped && given != null && (q.style === 'choice' ? given === q.answer : matchesAnswer(given, q.answer))
      const rec: AnswerRecord = { given, correct, ms, points: questionScore(correct, ms), ...(skipped ? { skipped } : {}) }
      setRevealed(rec)
      setAnswers((a) => [...a, rec])
    },
    [q, revealed, startedAt],
  )

  // timer: (re)start the clock for each question
  useEffect(() => {
    const t = performance.now()
    setStartedAt(t)
    setNow(t)
  }, [index])
  useEffect(() => {
    if (revealed) return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [revealed, index])
  useEffect(() => {
    if (startedAt && !revealed && remaining <= 0) submit(null)
  }, [remaining, revealed, submit, startedAt])

  // focus management
  useEffect(() => {
    if (revealed) nextRef.current?.focus()
    else if (q?.style === 'typing') inputRef.current?.focus()
  }, [revealed, q])

  const next = () => {
    if (index + 1 >= questions.length) {
      onDone(answers)
      return
    }
    setIndex(index + 1)
    setRevealed(null)
    setTyped('')
    setHi(-1)
  }

  if (!q) return null
  const pct = (remaining / QUESTION_TIME_MS) * 100

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm">
        <span className="rounded-md border border-gold/40 px-2 py-0.5 text-gold">{header}</span>
        <span className="text-muted">
          {index + 1} / {questions.length} · {Math.ceil(remaining / 1000)}s · <b className="text-text">{total}</b>
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded bg-line">
        <div className="h-full bg-gold transition-[width] duration-100 ease-linear" style={{ width: `${pct}%` }} />
      </div>

      <div className="rounded-xl border border-line bg-card p-5">
        <div className="mb-1 text-center text-xs text-muted">Set {q.setId}</div>
        <Prompt prompt={q.prompt} />
        <h2 className="mt-4 text-center text-lg font-semibold">{questionText(q)}</h2>
      </div>

      {q.style === 'choice' ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {q.choices!.map((c, i) => {
            const isAnswer = c === q.answer
            const isGiven = revealed?.given === c
            const tone = !revealed
              ? 'border-line bg-card hover:border-gold'
              : isAnswer
                ? 'border-ok bg-ok/40'
                : isGiven
                  ? 'border-no bg-no/40'
                  : 'border-line bg-card opacity-60'
            return (
              <button
                key={c}
                type="button"
                disabled={!!revealed}
                onClick={() => submit(c)}
                className={`rounded-lg border px-3 py-3 text-left text-sm transition ${tone}`}
              >
                <span className="mr-2 text-muted">{'ABCD'[i]}</span>
                {c}
              </button>
            )
          })}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const pick = hi >= 0 ? suggestions[hi] : undefined
            if (pick) submit(pick)
            else if (typed.trim()) submit(typed)
          }}
          className="relative flex gap-2"
        >
          <input
            ref={inputRef}
            value={typed}
            disabled={!!revealed}
            onChange={(e) => {
              setTyped(e.target.value)
              setHi(-1)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && suggestions.length) {
                e.preventDefault()
                setHi((h) => Math.min(h + 1, suggestions.length - 1))
              } else if (e.key === 'ArrowUp' && suggestions.length) {
                e.preventDefault()
                setHi((h) => Math.max(h - 1, -1))
              }
            }}
            role="combobox"
            aria-expanded={!revealed && suggestions.length > 0}
            aria-controls="quiz-suggestions"
            placeholder="พิมพ์ชื่อแล้วกด Enter"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className={`min-w-0 flex-1 rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:border-gold ${
              revealed ? (revealed.correct ? 'border-ok' : 'border-no') : 'border-line'
            }`}
          />
          <Button type="submit" disabled={!!revealed || !typed.trim()}>
            ตอบ
          </Button>
          {!revealed && suggestions.length > 0 && (
            <ul id="quiz-suggestions" role="listbox" className="absolute left-0 right-20 top-full z-10 mt-1 overflow-hidden rounded-lg border border-line bg-card shadow-xl">
              {suggestions.map((n, i) => (
                <li key={n} role="option" aria-selected={i === hi}>
                  <button
                    type="button"
                    onMouseEnter={() => setHi(i)}
                    onClick={() => submit(n)}
                    className={`w-full px-3 py-1.5 text-left text-sm ${i === hi ? 'bg-gold-dim' : ''}`}
                  >
                    {n}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      )}

      {!revealed && (
        <div className="flex justify-end">
          <button type="button" className="text-xs text-muted underline hover:text-text" onClick={() => submit(null, true)}>
            ยอมแพ้ข้อนี้
          </button>
        </div>
      )}

      {revealed && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card px-4 py-3">
          <div className="text-sm">
            {revealed.correct ? (
              <span className="text-ok brightness-150">ถูกต้อง! +{revealed.points}</span>
            ) : (
              <span>
                <span className="text-no brightness-150">{revealed.skipped ? 'ยอมแพ้' : revealed.given == null ? 'หมดเวลา' : 'ผิด'}</span>
                <span className="text-muted"> · คำตอบ: </span>
                <b>{q.answer}</b>
              </span>
            )}
          </div>
          <Button ref={nextRef} onClick={next}>
            {index + 1 >= questions.length ? 'ดูผล' : 'ข้อต่อไป'}
          </Button>
        </div>
      )}
    </div>
  )
}
