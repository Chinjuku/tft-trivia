import type { ComponentPropsWithRef, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

type Variant = 'primary' | 'ghost' | 'plain'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gold text-[#14110a] font-bold hover:brightness-110',
  ghost: 'border border-gold text-gold hover:bg-gold-dim',
  plain: 'border border-line bg-card text-text hover:border-muted',
}

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: ComponentPropsWithRef<'button'> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`rounded-lg px-4 py-2.5 text-center text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}

export function Card({ children, highlight = false, className = '' }: { children: ReactNode; highlight?: boolean; className?: string }) {
  return (
    <section className={`rounded-xl border p-4 ${highlight ? 'border-gold bg-gold-dim' : 'border-line bg-card'} ${className}`}>
      {children}
    </section>
  )
}

export function Chip({ on, children, onClick, title }: { on: boolean; children: ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs transition ${on ? 'border-gold text-gold' : 'border-line text-text/80 hover:border-muted'}`}
    >
      {children}
    </button>
  )
}

export function Loading({ label = 'กำลังโหลด…' }: { label?: string }) {
  return <p className="py-16 text-center text-muted">{label}</p>
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <Card className="border-no">
      <p className="font-semibold">มีบางอย่างผิดพลาด</p>
      <p className="mt-1 text-sm text-muted">{error instanceof Error ? error.message : String(error)}</p>
    </Card>
  )
}

export function Logo() {
  return (
    <span className="text-lg font-bold tracking-wide">
      TFT <span className="text-gold">Trivia</span>
    </span>
  )
}

/** "← หน้าแรก" link; asks first when leaving would throw away progress. */
export function BackButton({ to = '/', label = 'หน้าแรก', confirmMessage }: { to?: string; label?: string; confirmMessage?: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => {
        if (!confirmMessage || window.confirm(confirmMessage)) navigate(to)
      }}
      className="self-start text-sm text-muted hover:text-gold"
    >
      ← {label}
    </button>
  )
}
