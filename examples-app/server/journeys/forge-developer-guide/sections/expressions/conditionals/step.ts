import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const conditionalsStep = step({
  path: '/conditionals',
  title: 'Conditionals',
  isEntryPoint: true,
  metadata: { navGroup: 'Expressions' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('conditionals')],
    }),
  ],
  blocks: [content],
})
