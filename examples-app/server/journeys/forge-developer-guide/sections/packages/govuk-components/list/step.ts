import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const listStep = step({
  path: '/list',
  title: 'List',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Wrappers' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('govuk-list')],
    }),
  ],
  blocks: [content],
})
