import { step } from '@ministryofjustice/hmpps-forge/core/authoring'

import { LlmContent } from '../../functions/components/content/llmContent'
import type { LlmTurnBlocks } from '../../functions/renderers/turn/llmTurn'

export const completeStep = step<LlmTurnBlocks>({
  code: 'complete',
  path: '/complete',
  title: 'Complete',
  blocks: {
    content: [LlmContent({ content: 'Thanks — that gives Forge a rounded picture of what home means to you.' })],
    questions: [],
  },
})
