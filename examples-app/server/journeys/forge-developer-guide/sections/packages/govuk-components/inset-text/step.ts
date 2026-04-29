import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const insetTextStep = step({
  path: '/inset-text',
  title: 'Inset Text',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('govuk-inset-text')],
    }),
  ],
  blocks: [content],
})
