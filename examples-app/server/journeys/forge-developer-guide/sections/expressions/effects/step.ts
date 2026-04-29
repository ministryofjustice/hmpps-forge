import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const effectsStep = step({
  path: '/effects',
  title: 'Effects',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Functions' },
  onAccess: [loadContent('effects')],
  blocks: [content],
})
