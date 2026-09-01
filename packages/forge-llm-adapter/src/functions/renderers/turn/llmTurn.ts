import { z } from 'zod'

import {
  blockSchema,
  renderer,
  type BlockDefinition,
  type RendererFunctionContext,
} from '@ministryofjustice/hmpps-forge/core/components'
import type { LlmContentOutput } from '../../components/content/llmContent'
import type { LlmDateOutput } from '../../components/date/llmDate'
import type { LlmFreeTextOutput } from '../../components/free-text/llmFreeText'
import type { LlmMultiSelectOutput } from '../../components/multi-select/llmMultiSelect'
import type { LlmSingleSelectOutput } from '../../components/single-select/llmSingleSelect'

export interface LlmTurnBlocks {
  readonly content: BlockDefinition[]
  readonly questions: BlockDefinition[]
}

export type LlmQuestionOutput = LlmDateOutput | LlmFreeTextOutput | LlmMultiSelectOutput | LlmSingleSelectOutput

export type LlmComponentOutput = LlmContentOutput | LlmQuestionOutput

export interface LlmTurnOutput {
  readonly content: readonly LlmContentOutput[]
  readonly questions: readonly LlmQuestionOutput[]
}

/** Composes one conversational turn from informational content and questions. */
export const LlmTurn = renderer<Record<string, never>, LlmTurnBlocks, RendererFunctionContext>('llmTurn', {
  blocksSchema: z.strictObject({
    content: z.array(blockSchema),
    questions: z.array(blockSchema),
  }),
  factory: () => blocks => ({
    content: blocks.content.filter(isLlmContentOutput),
    questions: blocks.questions.filter(isLlmQuestionOutput),
  }),
})

function isLlmContentOutput(output: unknown): output is LlmContentOutput {
  return isRecord(output) && output.kind === 'content' && typeof output.content === 'string'
}

function isLlmQuestionOutput(output: unknown): output is LlmQuestionOutput {
  if (!isRecord(output) || typeof output.code !== 'string' || !Array.isArray(output.errors)) {
    return false
  }

  return ['date', 'free-text', 'multi-select', 'single-select'].includes(String(output.kind))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
