import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const sortableTableStep = step({
  path: '/sortable-table',
  title: 'Sortable Table',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('moj-sortable-table')],
    }),
  ],
  blocks: [content],
})
