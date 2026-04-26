import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const exitThisPageStep = step({
  path: '/exit-this-page',
  title: 'Exit This Page',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('govuk-exit-this-page')],
    }),
  ],
  blocks: [content],
})
