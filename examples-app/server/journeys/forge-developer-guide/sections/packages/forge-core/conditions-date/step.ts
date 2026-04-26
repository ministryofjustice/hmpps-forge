import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const conditionsDateStep = step({
  path: '/conditions-date',
  title: 'Dates',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Conditions' },
  onAccess: [loadContent('conditions-date')],
  blocks: [content],
})
