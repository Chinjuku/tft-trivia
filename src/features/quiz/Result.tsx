import { useNavigate } from 'react-router-dom'
import type { Question } from '../../engine/quiz'
import { dailyQuizShare } from '../../engine/score'
import { Button, Card } from '../../ui/kit'
import { ChallengeShare, CopyTextButton } from '../share/ChallengeShare'
import type { AnswerRecord } from './QuizRunner'
import type { Challenge, DistributiveOmit } from '../../engine/link'

export function VersusCard({ you, them, nick, lowerIsBetter = false, unit = '' }: { you: number; them: number; nick: string; lowerIsBetter?: boolean; unit?: string }) {
  const diff = you - them
  const youWin = lowerIsBetter ? diff < 0 : diff > 0
  return (
    <Card highlight>
      <div className="flex justify-between">
        <span>คุณ</span>
        <b className="text-gold">
          {you}
          {unit}
        </b>
      </div>
      <div className="flex justify-between">
        <span>{nick || 'เพื่อน'}</span>
        <b>
          {them}
          {unit}
        </b>
      </div>
      <div className="mt-2 text-sm">{diff === 0 ? '🤝 เสมอ' : youWin ? `🏆 คุณชนะ ${Math.abs(diff)}${unit}` : `😵 แพ้ไป ${Math.abs(diff)}${unit}`}</div>
    </Card>
  )
}

export function Result({
  title,
  questions,
  answers,
  daily,
  challenge,
  versus,
  newBest,
  onReplay,
}: {
  title: string
  questions: Question[]
  answers: AnswerRecord[]
  daily?: string
  challenge?: DistributiveOmit<Challenge, 'nick' | 'score'>
  versus?: { nick: string; score: number }
  newBest: boolean
  onReplay: () => void
}) {
  const navigate = useNavigate()
  const score = answers.reduce((s, a) => s + a.points, 0)
  const correct = answers.filter((a) => a.correct).length
  const missed = questions.map((q, i) => ({ q, a: answers[i], i })).filter((x) => !x.a?.correct)

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-muted">ผลการเล่น · {title}</div>
      <div className="flex items-end justify-between">
        <span className="text-4xl font-bold text-gold">{score.toLocaleString()}</span>
        <span>
          {correct} / {questions.length} ถูก
        </span>
      </div>
      {newBest && !daily && <div className="text-sm text-gold">✨ สถิติใหม่ของคุณ</div>}
      <div className="flex gap-1" aria-label="ผลแต่ละข้อ">
        {answers.map((a, i) => (
          <i key={i} className={`h-4 flex-1 rounded-sm ${a.correct ? 'bg-ok' : 'bg-no'}`} />
        ))}
      </div>

      {versus && <VersusCard you={score} them={versus.score} nick={versus.nick} />}

      {missed.length > 0 && (
        <Card>
          <div className="mb-2 text-sm text-muted">ข้อที่พลาด</div>
          <ul className="flex flex-col gap-1 text-sm">
            {missed.map(({ q, a, i }) => (
              <li key={i}>
                {i + 1} · {q.mode === 'set' && 'name' in q.prompt ? `${q.prompt.name} → ` : ''}<b>{q.answer}</b> <span className="text-muted">(Set {q.setId} · {a?.skipped ? 'ยอมแพ้' : a?.given == null ? 'หมดเวลา' : `ตอบ ${a.given}`})</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {daily ? (
        <Card highlight>
          <b>แชร์ผล Daily</b>
          <p className="mb-3 mt-1 text-sm text-muted">ทุกคนได้ชุดเดียวกันวันนี้ คัดลอกไปแปะในแชตกลุ่มได้เลย</p>
          <CopyTextButton
            label="คัดลอกผล"
            text={dailyQuizShare(daily, answers.map((a) => a.correct), score)}
          />
        </Card>
      ) : (
        challenge && (
          <Card highlight>
            <b>{versus ? 'ท้ากลับ' : 'ท้าเพื่อน'}</b>
            <p className="mb-3 mt-1 text-sm text-muted">เพื่อนจะได้ {questions.length} ข้อชุดนี้เป๊ะ แล้วเห็นคะแนนของคุณตอนจบ</p>
            <ChallengeShare challenge={{ ...challenge, score } as DistributiveOmit<Challenge, 'nick'>} />
          </Card>
        )
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onReplay}>
          เล่นอีกรอบ
        </Button>
        <Button variant="ghost" onClick={() => navigate('/')}>
          หน้าแรก
        </Button>
      </div>
    </div>
  )
}
