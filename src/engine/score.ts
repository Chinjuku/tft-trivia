// Scoring (design §5.1, §5.3)

export const QUESTION_TIME_MS = 20_000
export const BASE_POINTS = 100
export const MAX_SPEED_BONUS = 50

/** 100 for a correct answer + 0–50 speed bonus falling linearly over the time limit. Wrong = 0. */
export function questionScore(correct: boolean, elapsedMs: number, limitMs = QUESTION_TIME_MS): number {
  if (!correct) return 0
  const t = Math.min(Math.max(elapsedMs, 0), limitMs)
  return BASE_POINTS + Math.floor(MAX_SPEED_BONUS * (1 - t / limitMs))
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** "2026-11-12" -> "12 พ.ย." */
export function thaiShortDate(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number)
  return `${d} ${THAI_MONTHS[m - 1]}`
}

/** Text to paste in a group chat after the Daily Quiz. */
export function dailyQuizShare(isoDate: string, results: boolean[], score: number): string {
  const correct = results.filter(Boolean).length
  const row = results.map((r) => (r ? '🟩' : '🟥')).join('')
  return `TFT Trivia ${thaiShortDate(isoDate)} · ${correct}/${results.length} · ${score} pts\n${row}`
}

/** Text to paste after the daily champion guess. */
export function dailyGuessShare(isoDate: string, guesses: number, gaveUp: boolean, hints = 0): string {
  const used = hints ? ` (Hint ${hints})` : ''
  return `TFT Trivia ทาย Champion ${thaiShortDate(isoDate)} · ${gaveUp ? 'ยอมแพ้' : `${guesses} ครั้ง${used}`}`
}
