import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const definingStepsStep = step({
  path: '/defining-steps',
  title: 'Defining steps',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Building flows and content' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('defining-steps')],
    }),
  ],
  blocks: [content],
})
