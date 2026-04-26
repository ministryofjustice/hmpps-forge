import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const buildingCustomConditionsStep = step({
  path: '/custom-conditions',
  title: 'Custom conditions',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Functions' },
  onAccess: [loadContent('building-custom-conditions')],
  blocks: [content],
})
