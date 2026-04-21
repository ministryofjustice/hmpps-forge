import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const buildingJourneysOverviewStep = step({
  path: '/overview',
  title: 'Building journeys',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('building-journeys')],
    }),
  ],
  blocks: [content],
})
