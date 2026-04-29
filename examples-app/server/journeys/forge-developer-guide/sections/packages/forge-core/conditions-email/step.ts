import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const conditionsEmailStep = step({
  path: '/conditions-email',
  title: 'Email',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Conditions' },
  onAccess: [loadContent('conditions-email')],
  blocks: [content],
})
