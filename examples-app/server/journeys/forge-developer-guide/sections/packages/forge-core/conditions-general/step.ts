import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const conditionsGeneralStep = step({
  path: '/conditions-general',
  title: 'General',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Conditions' },
  onAccess: [loadContent('conditions-general')],
  blocks: [content],
})
