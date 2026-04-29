import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const buildingCustomTransformersStep = step({
  path: '/custom-transformers',
  title: 'Custom transformers',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Functions' },
  onAccess: [loadContent('building-custom-transformers')],
  blocks: [content],
})
