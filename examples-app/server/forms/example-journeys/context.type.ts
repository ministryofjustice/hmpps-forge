import { EffectFunctionContext } from '@ministryofjustice/hmpps-forge/core/authoring'
import type FormDataStore from '../../data/formDataStore'

// FORGE-EXAMPLE: Define typed interfaces for answers, session, and data to get
// full type safety in effect functions via a custom EffectFunctionContext alias.

/**
 * Form answers via context.setAnswer() / context.getAnswer()
 */
export interface FeedbackFormAnswers extends Record<string, unknown> {
  fullName: string
  contactMethod: 'email' | 'phone' | 'text'
  email: string
  phoneNumber: string
  mobileNumber: string
  feedback: string
}

/**
 * Session data via context.getSession()
 */
export interface ExampleJourneySession {
  id: string
}

/**
 * Typed effect context for the example journeys
 *
 * @example
 * const myEffect = (deps: Deps) => async (context: ExampleJourneyContext) => {
 *   context.getAnswer('fullName')          // typed as string
 *   context.getAnswer('contactMethod')     // typed as 'email' | 'phone' | 'text'
 *   context.getSession()?.id               // typed as string
 * }
 */
export type ExampleJourneyContext = EffectFunctionContext<
  Record<string, unknown>,
  FeedbackFormAnswers,
  ExampleJourneySession
>

export interface ExampleJourneyDeps {
  formDataStore: FormDataStore
}
