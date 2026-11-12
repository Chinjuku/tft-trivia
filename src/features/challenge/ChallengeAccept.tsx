import { useLocation, useNavigate } from 'react-router-dom'
import { decodeChallenge } from '../../engine/link'
import { GUESS_LABEL, MODE_LABEL, STYLE_LABEL } from '../../ui/labels'
import { Button, Card, Logo } from '../../ui/kit'
import { guessPath, playPath, QUIZ_COUNT } from '../routes'

export function ChallengeAccept() {
  const { search } = useLocation()
  const navigate = useNavigate()
  const c = decodeChallenge(search)

  if (!c) {
    return (
      <Card>
        <p className="font-semibold">ลิงก์ท้านี้ใช้ไม่ได้</p>
        <p className="mt-1 text-sm text-muted">ลิงก์อาจถูกตัดไปบางส่วน ลองขอลิงก์ใหม่จากเพื่อน</p>
        <Button className="mt-3" variant="ghost" onClick={() => navigate('/')}>
          ไปหน้าแรก
        </Button>
      </Card>
    )
  }

  const sets = c.setIds.length > 6 ? `${c.setIds.length} Set` : c.setIds.map((s) => `Set ${s}`).join(', ')
  const detail =
    c.kind === 'quiz'
      ? `${MODE_LABEL[c.mode].label} · ${sets} · ${QUIZ_COUNT} ข้อ · ${STYLE_LABEL[c.answerStyle]}`
      : `ทายปริศนา ${GUESS_LABEL[c.mode]} · ${sets}`

  const accept = () =>
    navigate(
      c.kind === 'quiz'
        ? playPath({ mode: c.mode, setIds: c.setIds, answerStyle: c.answerStyle, seed: c.seed, version: c.dataVersion, vsNick: c.nick, vsScore: c.score })
        : guessPath({ kind: c.mode, setIds: c.setIds, seed: c.seed, version: c.dataVersion, vsNick: c.nick, vsScore: c.score }),
    )

  return (
    <div className="flex flex-col gap-4">
      <Logo />
      <div className="text-sm text-muted">เปิดจากลิงก์ท้า</div>
      <Card highlight>
        <div>
          <b>{c.nick || 'เพื่อน'}</b> ท้าคุณ!
        </div>
        <div className="my-2 text-4xl font-bold text-gold">
          {c.score.toLocaleString()}
          {c.kind === 'guess' && <span className="ml-1 text-base font-normal text-text">ครั้ง</span>}
        </div>
        <div className="text-sm text-muted">{detail}</div>
        {c.kind === 'guess' && <div className="mt-1 text-xs text-muted">ทายให้ได้ในจำนวนครั้งที่น้อยกว่า</div>}
      </Card>
      <Button onClick={accept}>รับคำท้า</Button>
    </div>
  )
}
