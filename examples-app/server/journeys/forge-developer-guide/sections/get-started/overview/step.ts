import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const getStartedOverviewStep = step({
  path: '/',
  title: 'Get started',
  isEntryPoint: true,
  metadata: { hiddenFromNav: true },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('get-started')],
    }),
  ],
  blocks: [content],
})
