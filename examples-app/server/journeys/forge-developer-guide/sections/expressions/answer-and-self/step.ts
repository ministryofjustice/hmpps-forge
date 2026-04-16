import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const answerAndSelfStep = step({
  path: '/answer-and-self',
  title: 'Answer and Self',
  isEntryPoint: true,
  metadata: { navGroup: 'References' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('answer-and-self')],
    }),
  ],
  blocks: [content],
})
