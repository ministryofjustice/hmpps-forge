import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const buttonGroupStep = step({
  path: '/button-group',
  title: 'Button Group',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Wrappers' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('govuk-button-group')],
    }),
  ],
  blocks: [content],
})
