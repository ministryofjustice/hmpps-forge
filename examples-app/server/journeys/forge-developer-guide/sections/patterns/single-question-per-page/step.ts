import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const singleQuestionPerPagePatternStep = step({
  path: '/single-question-per-page',
  title: 'Single question per page',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Input and forms' },
  onAccess: [loadContent('patterns-single-question-per-page')],
  blocks: [content],
})
