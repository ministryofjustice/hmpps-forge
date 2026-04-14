import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const creatingYourFirstJourneyStep = step({
  path: '/creating-your-first-journey',
  title: 'Creating your first journey',
  isEntryPoint: true,
  metadata: { navGroup: 'Setup guides' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('creating-your-first-journey')],
    }),
  ],
  blocks: [content],
})
