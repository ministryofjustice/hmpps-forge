import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const shapingDataStep = step({
  path: '/shaping-data',
  title: 'Shaping data for rendering',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Working with data' },
  onAccess: [loadContent('shaping-data')],
  blocks: [content],
})
