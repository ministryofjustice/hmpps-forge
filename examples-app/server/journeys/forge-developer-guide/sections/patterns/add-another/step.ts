import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const addAnotherPatternStep = step({
  path: '/add-another',
  title: 'Adding, editing and deleting from collections',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Collections' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('patterns-add-another')],
    }),
  ],
  blocks: [content],
})
