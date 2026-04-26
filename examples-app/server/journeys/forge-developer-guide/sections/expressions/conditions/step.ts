import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const conditionsStep = step({
  path: '/conditions',
  title: 'Conditions',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Functions' },
  onAccess: [loadContent('conditions')],
  blocks: [content],
})
