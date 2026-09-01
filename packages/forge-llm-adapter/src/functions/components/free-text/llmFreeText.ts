import { z } from 'zod'

import { component } from '@ministryofjustice/hmpps-forge/core/components'

export interface LlmFreeText {
  /** The question or instruction presented to the user. */
  readonly prompt: string

  /** Additional guidance that helps the user answer. */
  readonly hint?: string

  /** Additional guidance presented only to the LLM resolving the answer. */
  readonly llmHint?: string

  /** Additional guidance presented only to the LLM clarifying the question. */
  readonly llmClarificationHint?: string

  /** Whether the user must answer after this question has been presented. */
  readonly requiresExplicitAnswer?: boolean
}

export interface LlmFreeTextOutput {
  readonly kind: 'free-text'
  readonly code: string
  readonly prompt: string
  readonly hint?: string
  readonly llmHint?: string
  readonly llmClarificationHint?: string
  readonly requiresExplicitAnswer?: boolean
  readonly value?: string
  readonly errors: readonly string[]
}

/** Collects one free-text answer through an LLM conversation. */
export const LlmFreeText = component<LlmFreeText>('llmFreeText', {
  field: true,
  inputSchema: z.string(),
  factory: () => props => ({
    kind: 'free-text',
    code: props.code,
    prompt: props.prompt,
    hint: props.hint,
    llmHint: props.llmHint,
    llmClarificationHint: props.llmClarificationHint,
    requiresExplicitAnswer: props.requiresExplicitAnswer,
    value: typeof props.value === 'string' ? props.value : undefined,
    errors: props.errors?.map(error => error.message) ?? [],
  }),
})
