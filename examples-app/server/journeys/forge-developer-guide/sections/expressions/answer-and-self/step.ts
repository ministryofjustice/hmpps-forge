import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const answerAndSelfStep = step({
  path: '/answer-and-self',
  title: 'Answer and Self',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'References' },
  onAccess: [loadContent('answer-and-self')],
  blocks: [content],
})
