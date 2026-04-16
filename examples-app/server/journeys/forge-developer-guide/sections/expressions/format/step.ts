import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const formatStep = step({
  path: '/format',
  title: 'Format',
  isEntryPoint: true,
  metadata: { navGroup: 'Expressions' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('format')],
    }),
  ],
  blocks: [content],
})
