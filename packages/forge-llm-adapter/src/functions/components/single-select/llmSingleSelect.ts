import { z } from 'zod'

import { Condition, Self, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import { component } from '@ministryofjustice/hmpps-forge/core/components'

export interface LlmSingleSelectOption {
  readonly value: string
  readonly text: string
  readonly hint?: string
  readonly visibleWhen?: boolean
}

export interface LlmSingleSelect {
  /** The question or instruction presented to the user. */
  readonly prompt: string

  /** Additional guidance that helps the user choose. */
  readonly hint?: string

  /** Additional guidance presented only to the LLM resolving the answer. */
  readonly llmHint?: string

  /** Additional guidance presented only to the LLM clarifying the question. */
  readonly llmClarificationHint?: string

  /** Whether the user must answer after this question has been presented. */
  readonly requiresExplicitAnswer?: boolean

  /** The mutually exclusive choices available to the user. */
  readonly options: readonly LlmSingleSelectOption[]
}

export interface LlmSingleSelectOutput {
  readonly kind: 'single-select'
  readonly code: string
  readonly prompt: string
  readonly hint?: string
  readonly llmHint?: string
  readonly llmClarificationHint?: string
  readonly requiresExplicitAnswer?: boolean
  readonly options: readonly Omit<LlmSingleSelectOption, 'visibleWhen'>[]
  readonly value?: string
  readonly errors: readonly string[]
}

/** Collects one answer from a set of mutually exclusive choices. */
export const LlmSingleSelect = component<LlmSingleSelect>('llmSingleSelect', {
  field: true,
  inputSchema: z.string(),
  prepare: props => {
    if (!Array.isArray(props.options) || (props.validWhen !== undefined && !Array.isArray(props.validWhen))) {
      return props
    }

    const allowedValues = props.options.flatMap(option => {
      if (typeof option !== 'object' || option === null || !('value' in option)) {
        return []
      }

      if ('visibleWhen' in option && option.visibleWhen === false) {
        return []
      }

      return [option.value]
    })

    return {
      ...props,
      validWhen: [
        ...(props.validWhen ?? []),
        validation({
          condition: Self().match(Condition.Array.IsIn(allowedValues)),
          message: 'Select one of the available options',
        }),
      ],
    }
  },
  factory: () => props => ({
    kind: 'single-select',
    code: props.code,
    prompt: props.prompt,
    hint: props.hint,
    llmHint: props.llmHint,
    llmClarificationHint: props.llmClarificationHint,
    requiresExplicitAnswer: props.requiresExplicitAnswer,
    options: props.options
      .filter(option => option.visibleWhen !== false)
      .map(({ value, text, hint }) => ({ value, text, hint })),
    value: typeof props.value === 'string' ? props.value : undefined,
    errors: props.errors?.map(error => error.message) ?? [],
  }),
})
