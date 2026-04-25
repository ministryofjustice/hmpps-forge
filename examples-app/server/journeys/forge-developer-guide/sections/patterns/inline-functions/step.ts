import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const inlineFunctionsPatternStep = step({
  path: '/inline-functions',
  title: 'Shaping data inline',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Data and integrations' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('patterns-inline-functions')],
    }),
  ],
  blocks: [content],
})
