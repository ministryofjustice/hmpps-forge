import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const getStartedOverviewStep = step({
  path: '/overview',
  title: 'Get started',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('get-started')],
    }),
  ],
  blocks: [content],
})
