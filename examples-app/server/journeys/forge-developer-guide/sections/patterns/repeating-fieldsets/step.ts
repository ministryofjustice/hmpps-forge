import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const repeatingFieldsetsPatternStep = step({
  path: '/repeating-fieldsets',
  title: 'Repeating fieldsets',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Collections' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('patterns-repeating-fieldsets')],
    }),
  ],
  blocks: [content],
})
