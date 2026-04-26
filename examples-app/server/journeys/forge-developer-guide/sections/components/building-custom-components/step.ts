import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const buildingCustomComponentsStep = step({
  path: '/custom-components',
  title: 'Custom components',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [loadContent('building-custom-components')],
  blocks: [content],
})
