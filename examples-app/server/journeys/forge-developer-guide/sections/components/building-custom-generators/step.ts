import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const buildingCustomGeneratorsStep = step({
  path: '/custom-generators',
  title: 'Custom generators',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Functions' },
  onAccess: [loadContent('building-custom-generators')],
  blocks: [content],
})
