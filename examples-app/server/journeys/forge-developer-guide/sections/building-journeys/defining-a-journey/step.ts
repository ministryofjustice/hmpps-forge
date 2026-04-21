import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const definingAJourneyStep = step({
  path: '/defining-a-journey',
  title: 'Defining a journey',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Building flows and content' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('defining-a-journey')],
    }),
  ],
  blocks: [content],
})
