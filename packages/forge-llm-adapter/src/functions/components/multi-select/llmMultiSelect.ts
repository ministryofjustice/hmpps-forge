import { z } from 'zod'

import { Condition, Self, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import { component } from '@ministryofjustice/hmpps-forge/core/components'

export interface LlmMultiSelectOption {
  readonly value: string
  readonly text: string
  readonly hint?: string
  readonly visibleWhen?: boolean
}

export interface LlmMultiSelect {
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

  /** The choices available to the user. */
  readonly options: readonly LlmMultiSelectOption[]
}

export interface LlmMultiSelectOutput {
  readonly kind: 'multi-select'
  readonly code: string
  readonly prompt: string
  readonly hint?: string
  readonly llmHint?: string
  readonly llmClarificationHint?: string
  readonly requiresExplicitAnswer?: boolean
  readonly options: readonly Omit<LlmMultiSelectOption, 'visibleWhen'>[]
  readonly value: readonly string[]
  readonly errors: readonly string[]
}

/** Collects any number of answers from a set of choices. */
export const LlmMultiSelect = component<LlmMultiSelect>('llmMultiSelect', {
  field: true,
  inputSchema: z.array(z.string()),
  multiple: true,
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
          condition: Self().match(Condition.Array.ContainsAll(allowedValues)),
          message: 'Select only from the available options',
        }),
      ],
    }
  },
  factory: () => props => ({
    kind: 'multi-select',
    code: props.code,
    prompt: props.prompt,
    hint: props.hint,
    llmHint: props.llmHint,
    llmClarificationHint: props.llmClarificationHint,
    requiresExplicitAnswer: props.requiresExplicitAnswer,
    options: props.options
      .filter(option => option.visibleWhen !== false)
      .map(({ value, text, hint }) => ({ value, text, hint })),
    value: Array.isArray(props.value) ? props.value.filter(value => typeof value === 'string') : [],
    errors: props.errors?.map(error => error.message) ?? [],
  }),
})
