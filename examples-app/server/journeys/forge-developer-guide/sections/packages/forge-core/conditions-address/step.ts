import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const conditionsAddressStep = step({
  path: '/conditions-address',
  title: 'Address',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Conditions' },
  onAccess: [loadContent('conditions-address')],
  blocks: [content],
})
