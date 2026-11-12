import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Popup dialog: bottom sheet on phones, centered card from `sm` up.
 * Closes on Esc, backdrop click or ✕; locks page scroll; returns focus to the opener.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  hero,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** optional full-width image area above the title */
  hero?: ReactNode
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      opener?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  const width = size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-2xl'

  return createPortal(
    <div className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`modal-panel relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-card shadow-2xl outline-none sm:max-h-[88dvh] sm:rounded-2xl ${width}`}
      >
        {/* grab handle on phones */}
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-base hover:bg-black/80"
        >
          ✕
        </button>
        <div className="overflow-y-auto overscroll-contain">
          {hero}
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <h2 id={titleId} className="pr-10 text-xl font-bold sm:text-2xl">
              {title}
            </h2>
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
