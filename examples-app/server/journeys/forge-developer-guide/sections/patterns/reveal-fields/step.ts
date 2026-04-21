import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const revealFieldsPatternStep = step({
  path: '/reveal-fields',
  title: 'Reveal fields',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Input and forms' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('patterns-reveal-fields')],
    }),
  ],
  blocks: [content],
})
