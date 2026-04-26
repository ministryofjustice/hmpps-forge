import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const generatorsStep = step({
  path: '/generators',
  title: 'Generators',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Functions' },
  onAccess: [loadContent('generators')],
  blocks: [content],
})
