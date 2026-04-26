import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const conditionalsStep = step({
  path: '/conditionals',
  title: 'Conditionals',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Expressions' },
  onAccess: [loadContent('conditionals')],
  blocks: [content],
})
