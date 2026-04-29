import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const validationsStep = step({
  path: '/validations',
  title: 'Validations',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Utilities' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('govuk-validations')],
    }),
  ],
  blocks: [content],
})
