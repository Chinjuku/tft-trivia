import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { dailyVersion, loadSets, resolveVersion, verifiedSetIds } from '../../data/loader'
import { dailySeed, thaiDate } from '../../engine/link'
import { generateQuiz, type Question, type QuizConfig } from '../../engine/quiz'
import { newSeed } from '../../engine/rng'
import { getDailyQuiz, recordBest, saveDailyQuiz } from '../../lib/storage'
import { MODE_LABEL } from '../../ui/labels'
import { Card, ErrorBox, Loading } from '../../ui/kit'
import { useAsync } from '../../ui/useAsync'
import { parsePlay, playPath, QUIZ_COUNT } from '../routes'
import { QuizRunner, type AnswerRecord } from './QuizRunner'
import { Result } from './Result'

interface Prepared {
  questions: Question[]
  version: number
  fellBack: boolean
  config: QuizConfig
  seed: string
  daily?: string
  alreadyPlayedDaily: boolean
}

export function Play() {
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const params = parsePlay(search)

  // A free game without a seed gets one, written into the URL so reload/share replays the same quiz.
  useEffect(() => {
    if (!params.daily && !params.seed) navigate(playPath({ ...params, seed: newSeed() }), { replace: true })
  }, [params, navigate])

  const key = search.toString()
  const state = useAsync<Prepared | null>(async () => {
    if (!params.daily && !params.seed) return null
    if (params.daily) {
      const date = thaiDate()
      const v = params.version ?? (await dailyVersion(date))
      const { version, fellBack } = await resolveVersion(v)
      const ids = await verifiedSetIds(version)
      const config: QuizConfig = { mode: 'daily', setIds: ids, answerStyle: 'mixed', count: QUIZ_COUNT }
      const seed = dailySeed(date)
      const questions = generateQuiz(config, seed, await loadSets(version, ids))
      return { questions, version, fellBack, config, seed, daily: date, alreadyPlayedDaily: !!getDailyQuiz(date) }
    }
    const { version, fellBack } = await resolveVersion(params.version)
    const verified = await verifiedSetIds(version)
    const ids = params.setIds.length ? params.setIds.filter((id) => verified.includes(id)) : verified
    const config: QuizConfig = { mode: params.mode, setIds: ids, answerStyle: params.answerStyle, count: QUIZ_COUNT }
    const questions = generateQuiz(config, params.seed!, await loadSets(version, ids))
    return { questions, version, fellBack, config, seed: params.seed!, alreadyPlayedDaily: false }
  }, [key])

  if (state.status === 'loading' || (state.status === 'ready' && !state.value)) return <Loading />
  if (state.status === 'error') return <ErrorBox error={state.error} />
  return <PlayView key={key} prepared={state.value!} vs={params.vsNick != null && params.vsScore != null ? { nick: params.vsNick, score: params.vsScore } : undefined} />
}

function PlayView({ prepared, vs }: { prepared: Prepared; vs?: { nick: string; score: number } }) {
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<AnswerRecord[] | null>(null)
  const [newBest, setNewBest] = useState(false)
  const { questions, config, daily } = prepared
  const title = daily ? 'Daily Quiz' : `${MODE_LABEL[config.mode as keyof typeof MODE_LABEL].label} · ${config.setIds.length > 6 ? 'หลาย Set' : config.setIds.map((s) => `Set ${s}`).join(', ')}`

  if (!questions.length) {
    return (
      <Card>
        <p>สร้างคำถามจาก Set ที่เลือกไม่ได้ ลองเลือก Set เพิ่ม</p>
      </Card>
    )
  }

  const finish = (a: AnswerRecord[]) => {
    const score = a.reduce((s, x) => s + x.points, 0)
    if (daily) {
      if (!prepared.alreadyPlayedDaily) saveDailyQuiz(daily, { results: a.map((x) => x.correct), score })
    } else {
      setNewBest(recordBest(`quiz:${config.mode}`, score))
    }
    setAnswers(a)
  }

  if (answers) {
    return (
      <Result
        title={title}
        questions={questions}
        answers={answers}
        daily={daily}
        newBest={newBest}
        versus={vs}
        challenge={
          daily
            ? undefined
            : {
                kind: 'quiz',
                dataVersion: prepared.version,
                mode: config.mode as 'champion',
                setIds: config.setIds,
                answerStyle: config.answerStyle,
                seed: prepared.seed,
              }
        }
        onReplay={() =>
          daily
            ? navigate('/')
            : navigate(playPath({ mode: config.mode as 'champion', setIds: config.setIds, answerStyle: config.answerStyle, seed: undefined }))
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {prepared.fellBack && (
        <Card className="border-part text-sm">ข้อมูลเกมอัปเดตแล้ว ลิงก์นี้อาจได้คำถามไม่ตรงกับของเพื่อน</Card>
      )}
      {daily && prepared.alreadyPlayedDaily && <Card className="text-sm text-muted">คุณเล่น Daily วันนี้ไปแล้ว รอบนี้ไม่นับคะแนน</Card>}
      {vs && (
        <Card className="text-sm">
          <b>{vs.nick || 'เพื่อน'}</b> ทำไว้ <b className="text-gold">{vs.score.toLocaleString()}</b> คะแนน
        </Card>
      )}
      <QuizRunner questions={questions} header={title} onDone={finish} />
    </div>
  )
}
