import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const buildingCustomEffectsStep = step({
  path: '/custom-effects',
  title: 'Custom effects',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Functions' },
  onAccess: [loadContent('building-custom-effects')],
  blocks: [content],
})
