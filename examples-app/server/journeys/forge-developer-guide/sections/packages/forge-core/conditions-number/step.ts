import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const conditionsNumberStep = step({
  path: '/conditions-number',
  title: 'Numbers',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Conditions' },
  onAccess: [loadContent('conditions-number')],
  blocks: [content],
})
