// Quiz generation (design §5.1, §5.3). Pure: generateQuiz(config, seed, sets) -> same output everywhere.
import type { Champion, Item, SetData, Trait } from '../data/types'
import { normalizeAnswer } from './answer'
import { createRng, type Rng } from './rng'

export type QuizMode = 'champion' | 'item' | 'trait' | 'set'
/** 'daily' mixes all four modes per question */
export type QuizModeConfig = QuizMode | 'daily'
export type AnswerStyleConfig = 'choice' | 'typing' | 'mixed'
export type AnswerStyle = 'choice' | 'typing'

export interface QuizConfig {
  mode: QuizModeConfig
  /** sets to draw from; order does not matter */
  setIds: string[]
  answerStyle: AnswerStyleConfig
  count: number
}

export type Prompt =
  | { kind: 'image'; image: string; name: string }
  | { kind: 'recipe'; parts: { name: string; icon: string }[] }
  | { kind: 'trait-members'; champions: { name: string; icon: string }[] }
  | { kind: 'champion-card'; name: string; image: string; traits: string[]; cost: number }
  | { kind: 'trait-card'; name: string; icon: string; breakpoints: number[] }

export interface Question {
  mode: QuizMode
  /** set the subject belongs to */
  setId: string
  prompt: Prompt
  style: AnswerStyle
  /** display text of the correct answer (a name, or "Set 4.5" in set mode) */
  answer: string
  /** 4 options incl. the answer, when style is choice */
  choices?: string[]
  /** no-repeat key: identity for champions, normalized name for items/traits */
  key: string
}

export const CHOICE_COUNT = 4
export const MIXED_CHOICE_RATIO = 0.6
const MAX_ATTEMPTS_PER_QUESTION = 60

export const setLabel = (id: string) => `Set ${id}`

const byKey = <T extends { key: string }>(a: T, b: T) => a.key.localeCompare(b.key)
const bySetNumber = (a: SetData, b: SetData) => a.number - b.number || a.id.localeCompare(b.id)

/** Sort everything so output never depends on file or argument order. */
function canonical(sets: SetData[], setIds: string[]): SetData[] {
  const wanted = new Set(setIds)
  return sets
    .filter((s) => wanted.has(s.id))
    .sort(bySetNumber)
    .map((s) => ({
      ...s,
      champions: [...s.champions].sort(byKey),
      items: [...s.items].sort(byKey),
      traits: [...s.traits].sort(byKey),
    }))
}

/** Pick n distinct-by-name distractors (excluding `answer`), preferring `primary`, then `fallback`. */
function distractorNames(rng: Rng, answer: string, primary: string[], fallback: string[], n = CHOICE_COUNT - 1): string[] | null {
  const seen = new Set([normalizeAnswer(answer)])
  const out: string[] = []
  for (const pool of [rng.shuffle(primary), rng.shuffle(fallback)]) {
    for (const name of pool) {
      const k = normalizeAnswer(name)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(name)
      if (out.length === n) return out
    }
  }
  return null
}

interface Ctx {
  rng: Rng
  sets: SetData[]
  used: Set<string>
  style: AnswerStyle
}

type Built = Omit<Question, 'style' | 'key'> & { usedKey: string }

function finish(ctx: Ctx, b: Built, distractors: string[] | null): Question | null {
  if (ctx.used.has(b.usedKey)) return null
  const { usedKey, ...q } = b
  if (ctx.style === 'choice') {
    if (!distractors) return null
    return { ...q, key: usedKey, style: 'choice', choices: ctx.rng.shuffle([b.answer, ...distractors]) }
  }
  return { ...q, key: usedKey, style: 'typing' }
}

function championQuestion(ctx: Ctx): Question | null {
  const set = ctx.rng.pick(ctx.sets)
  const pool = set.champions.filter((c) => c.image)
  if (!pool.length) return null
  const c = ctx.rng.pick(pool)
  const others = (cs: Champion[]) => cs.filter((x) => x.identity !== c.identity && x.image !== c.image).map((x) => x.name)
  const distractors =
    ctx.style === 'choice'
      ? distractorNames(ctx.rng, c.name, others(set.champions.filter((x) => x.cost === c.cost)), others(ctx.sets.flatMap((s) => s.champions)))
      : null
  return finish(ctx, { mode: 'champion', setId: set.id, prompt: { kind: 'image', image: c.image, name: c.name }, answer: c.name, usedKey: `c:${c.identity}` }, distractors)
}

function itemQuestion(ctx: Ctx): Question | null {
  const set = ctx.rng.pick(ctx.sets)
  const pool = set.items.filter((i) => i.icon || i.recipe)
  if (!pool.length) return null
  const it = ctx.rng.pick(pool)
  const parts = it.recipe?.map((k) => set.items.find((x) => x.key === k)).filter((x): x is Item => !!x)
  const useRecipe = !!parts && parts.length === 2 && (!it.icon || ctx.rng.next() < 0.4)
  const prompt: Prompt = useRecipe
    ? { kind: 'recipe', parts: parts!.map((p) => ({ name: p.name, icon: p.icon })) }
    : { kind: 'image', image: it.icon, name: it.name }
  if (prompt.kind === 'image' && !it.icon) return null
  // A recipe can map to different items across sets: the answer must be the item from this set's recipe,
  // and no distractor may share that exact recipe.
  const recipeKey = (i: Item) => (i.recipe ? [...i.recipe].sort().join('+') : '')
  const sameRecipeNames = new Set(
    useRecipe ? ctx.sets.flatMap((s) => s.items).filter((x) => recipeKey(x) === recipeKey(it)).map((x) => normalizeAnswer(x.name)) : [],
  )
  // Some items reuse another's icon (Thief's Gloves / Accomplice's Gloves): never offer those, never ask them typed.
  const sameIconNames = new Set(
    prompt.kind === 'image' ? ctx.sets.flatMap((s) => s.items).filter((x) => x.icon === it.icon).map((x) => normalizeAnswer(x.name)) : [],
  )
  if (sameIconNames.size > 1 && ctx.style === 'typing') return null
  const others = (is: Item[]) =>
    is
      .filter((x) => !sameRecipeNames.has(normalizeAnswer(x.name)) && !sameIconNames.has(normalizeAnswer(x.name)))
      .filter((x) => normalizeAnswer(x.name) !== normalizeAnswer(it.name))
      .map((x) => x.name)
  const distractors =
    ctx.style === 'choice'
      ? distractorNames(ctx.rng, it.name, others(set.items.filter((x) => x.kind === it.kind)), others(ctx.sets.flatMap((s) => s.items).filter((x) => x.kind === it.kind)))
      : null
  if (useRecipe && sameRecipeNames.size > 1 && ctx.style === 'typing') return null // ambiguous to type
  return finish(ctx, { mode: 'item', setId: set.id, prompt, answer: it.name, usedKey: `i:${normalizeAnswer(it.name)}` }, distractors)
}

function traitQuestion(ctx: Ctx): Question | null {
  const set = ctx.rng.pick(ctx.sets)
  const pool = set.traits.filter((t) => t.icon || t.championKeys.length >= 2)
  if (!pool.length) return null
  const t = ctx.rng.pick(pool)
  const members = t.championKeys.map((k) => set.champions.find((c) => c.key === k)).filter((c): c is Champion => !!c)
  // Member list only identifies a trait uniquely within its set, so it is used only when no other trait
  // in the chosen sets has exactly the same members by name.
  const memberSig = (tr: Trait, s: SetData) =>
    tr.championKeys.map((k) => s.champions.find((c) => c.key === k)?.name ?? '').sort().join('|')
  const sig = memberSig(t, set)
  const uniqueMembers = members.length >= 2 && ctx.sets.every((s) => s.traits.every((x) => x === t || memberSig(x, s) !== sig))
  const useMembers = uniqueMembers && (!t.icon || ctx.rng.next() < 0.4)
  if (!useMembers && !t.icon) return null
  const prompt: Prompt = useMembers
    ? { kind: 'trait-members', champions: ctx.rng.shuffle(members).map((c) => ({ name: c.name, icon: c.icon })) }
    : { kind: 'image', image: t.icon, name: t.name }
  const sameIconNames = new Set(
    prompt.kind === 'image' ? ctx.sets.flatMap((s) => s.traits).filter((x) => x.icon === t.icon).map((x) => normalizeAnswer(x.name)) : [],
  )
  if (sameIconNames.size > 1 && ctx.style === 'typing') return null
  const others = (ts: Trait[]) =>
    ts.filter((x) => normalizeAnswer(x.name) !== normalizeAnswer(t.name) && !sameIconNames.has(normalizeAnswer(x.name))).map((x) => x.name)
  const distractors =
    ctx.style === 'choice' ? distractorNames(ctx.rng, t.name, others(set.traits), others(ctx.sets.flatMap((s) => s.traits))) : null
  return finish(ctx, { mode: 'trait', setId: set.id, prompt, answer: t.name, usedKey: `t:${normalizeAnswer(t.name)}` }, distractors)
}

function setQuestion(ctx: Ctx): Question | null {
  if (ctx.sets.length < CHOICE_COUNT) return null
  const set = ctx.rng.pick(ctx.sets)
  const askChampion = ctx.rng.next() < 0.6
  if (askChampion) {
    const pool = set.champions.filter((c) => c.image)
    if (!pool.length) return null
    const c = ctx.rng.pick(pool)
    // never offer a set where the same character also appears
    const valid = ctx.sets.filter((s) => s.id !== set.id && !s.champions.some((x) => x.identity === c.identity))
    if (valid.length < CHOICE_COUNT - 1) return null
    const traitNames = c.traits.map((k) => set.traits.find((t) => t.key === k)?.name ?? '').filter(Boolean)
    const distractors = ctx.rng.sample(valid, CHOICE_COUNT - 1).map((s) => setLabel(s.id))
    return finish(
      { ...ctx, style: 'choice' },
      {
        mode: 'set',
        setId: set.id,
        prompt: { kind: 'champion-card', name: c.name, image: c.image, traits: traitNames, cost: c.cost },
        answer: setLabel(set.id),
        usedKey: `s:c:${c.identity}`,
      },
      distractors,
    )
  }
  const pool = set.traits.filter((t) => t.icon)
  if (!pool.length) return null
  const t = ctx.rng.pick(pool)
  const n = normalizeAnswer(t.name)
  const valid = ctx.sets.filter((s) => s.id !== set.id && !s.traits.some((x) => normalizeAnswer(x.name) === n))
  if (valid.length < CHOICE_COUNT - 1) return null
  const distractors = ctx.rng.sample(valid, CHOICE_COUNT - 1).map((s) => setLabel(s.id))
  return finish(
    { ...ctx, style: 'choice' },
    {
      mode: 'set',
      setId: set.id,
      prompt: { kind: 'trait-card', name: t.name, icon: t.icon, breakpoints: t.breakpoints },
      answer: setLabel(set.id),
      usedKey: `s:t:${n}`,
    },
    distractors,
  )
}

const BUILDERS: Record<QuizMode, (ctx: Ctx) => Question | null> = {
  champion: championQuestion,
  item: itemQuestion,
  trait: traitQuestion,
  set: setQuestion,
}

export const ALL_MODES: QuizMode[] = ['champion', 'item', 'trait', 'set']

export function generateQuiz(config: QuizConfig, seed: string, allSets: SetData[]): Question[] {
  const rng = createRng(`${seed}|${config.mode}|${[...config.setIds].sort().join(',')}|${config.answerStyle}|${config.count}`)
  const sets = canonical(allSets, config.setIds)
  if (!sets.length) return []
  const used = new Set<string>()
  const out: Question[] = []
  for (let q = 0; q < config.count; q++) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_QUESTION; attempt++) {
      const mode = config.mode === 'daily' ? rng.pick(ALL_MODES) : config.mode
      const style: AnswerStyle =
        mode === 'set' || config.answerStyle === 'choice'
          ? 'choice'
          : config.answerStyle === 'typing'
            ? 'typing'
            : rng.next() < MIXED_CHOICE_RATIO
              ? 'choice'
              : 'typing'
      const ctx: Ctx = { rng, sets, used, style }
      const question = BUILDERS[mode](ctx)
      if (!question) continue
      used.add(question.key)
      out.push(question)
      break
    }
  }
  return out
}
