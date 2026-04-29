import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const repeatingFieldsetsPatternStep = step({
  path: '/repeating-fieldsets',
  title: 'Repeating fieldsets',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Collections' },
  onAccess: [loadContent('patterns-repeating-fieldsets')],
  blocks: [content],
})
