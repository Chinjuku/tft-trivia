import type { Prompt as PromptT } from '../../engine/quiz'
import { Img } from '../../ui/Img'

export function Prompt({ prompt }: { prompt: PromptT }) {
  switch (prompt.kind) {
    case 'image':
      // name is only for alt/fallback; the fallback letter would give the answer away, so hide it
      return <Img src={prompt.image} name="?" className="mx-auto h-36 w-36 rounded-lg border border-line" />
    case 'recipe':
      return (
        <div className="flex items-center justify-center gap-3">
          {prompt.parts.map((p, i) => (
            <div key={i} className="flex items-center gap-3">
              {i > 0 && <span className="text-2xl text-muted">+</span>}
              <div className="flex flex-col items-center gap-1">
                <Img src={p.icon} name={p.name} className="h-16 w-16 rounded-lg border border-line" />
                <span className="text-xs text-muted">{p.name}</span>
              </div>
            </div>
          ))}
          <span className="text-2xl text-muted">=</span>
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-gold text-2xl text-gold">?</div>
        </div>
      )
    case 'trait-members':
      return (
        <div className="flex flex-wrap justify-center gap-2">
          {prompt.champions.map((c) => (
            <div key={c.name} className="flex w-16 flex-col items-center gap-1">
              <Img src={c.icon} name={c.name} className="h-14 w-14 rounded-md border border-line" />
              <span className="truncate text-[11px] text-muted">{c.name}</span>
            </div>
          ))}
        </div>
      )
    case 'champion-card':
      return (
        <div className="flex items-center justify-center gap-4">
          <Img src={prompt.image} name={prompt.name} className="h-28 w-28 rounded-lg border border-line" />
          <div>
            <div className="text-lg font-semibold">{prompt.name}</div>
            <div className="text-sm text-gold">Cost {prompt.cost}</div>
            <div className="mt-1 text-sm text-muted">{prompt.traits.join(' · ')}</div>
          </div>
        </div>
      )
    case 'trait-card':
      return (
        <div className="flex items-center justify-center gap-4">
          <Img src={prompt.icon} name={prompt.name} className="h-20 w-20 rounded-lg border border-line bg-card p-2" />
          <div>
            <div className="text-lg font-semibold">{prompt.name}</div>
            <div className="text-sm text-muted">ขั้น {prompt.breakpoints.join(' / ')}</div>
          </div>
        </div>
      )
  }
}
