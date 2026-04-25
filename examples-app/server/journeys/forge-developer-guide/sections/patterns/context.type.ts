import { EffectFunctionContext } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { Session } from 'express-session'

/**
 * Patterns use the express session for answer storage. This keeps the examples
 * self-contained with no external dependency on Redis or a database.
 *
 * Each pattern owns a key under `session.patterns` so patterns cannot collide.
 */
export type PatternSession = Session & {
  patternDrafts?: Record<string, Record<string, unknown>>
  patternSubmitted?: Record<string, boolean>
  demoUser?: { name: string; role: string }
}

export type PatternEffectContext = EffectFunctionContext<
  Record<string, unknown>,
  Record<string, unknown>,
  PatternSession
>
