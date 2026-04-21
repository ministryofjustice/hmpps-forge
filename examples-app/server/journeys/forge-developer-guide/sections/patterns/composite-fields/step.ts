import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const compositeFieldsPatternStep = step({
  path: '/composite-fields',
  title: 'Multi-part composite fields',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Input and forms' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('patterns-composite-fields')],
    }),
  ],
  blocks: [content],
})
