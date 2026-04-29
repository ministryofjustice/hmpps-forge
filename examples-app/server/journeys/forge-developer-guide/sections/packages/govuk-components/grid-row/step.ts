import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const gridRowStep = step({
  path: '/grid-row',
  title: 'Grid Row',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Wrappers' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('govuk-grid-row')],
    }),
  ],
  blocks: [content],
})
