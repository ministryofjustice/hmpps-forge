import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const expressionsOverviewStep = step({
  path: '/',
  title: 'Expressions',
  isEntryPoint: true,
  metadata: { hiddenFromNav: true },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('expressions')],
    }),
  ],
  blocks: [content],
})
