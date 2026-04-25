import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const shapingDataStep = step({
  path: '/shaping-data',
  title: 'Shaping data for rendering',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Working with data' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('shaping-data')],
    }),
  ],
  blocks: [content],
})
