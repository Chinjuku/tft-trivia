import type { Question } from '../../engine/quiz'

export function questionText(q: Question): string {
  const p = q.prompt
  if (q.mode === 'set') return 'อยู่ใน Set ไหน?'
  if (p.kind === 'recipe') return 'รวมสองชิ้นนี้ได้อะไร?'
  if (p.kind === 'trait-members') return 'ตัวละครเหล่านี้มี Trait อะไรร่วมกัน?'
  if (q.mode === 'champion') return 'ตัวละครนี้คือใคร?'
  if (q.mode === 'item') return 'ไอเทมนี้คืออะไร?'
  return 'Trait นี้ชื่ออะไร?'
}
