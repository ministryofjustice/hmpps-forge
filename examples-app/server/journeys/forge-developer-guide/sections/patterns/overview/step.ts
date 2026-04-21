import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const patternsOverviewStep = step({
  path: '/overview',
  title: 'Patterns',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('patterns')],
    }),
  ],
  blocks: [content],
})
