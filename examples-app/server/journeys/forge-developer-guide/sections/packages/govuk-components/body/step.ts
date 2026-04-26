import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const bodyStep = step({
  path: '/body',
  title: 'Body',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Wrappers' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('govuk-body')],
    }),
  ],
  blocks: [content],
})
