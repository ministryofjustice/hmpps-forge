import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const pageHeaderActionsStep = step({
  path: '/page-header-actions',
  title: 'Page Header Actions',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('moj-page-header-actions')],
    }),
  ],
  blocks: [content],
})
