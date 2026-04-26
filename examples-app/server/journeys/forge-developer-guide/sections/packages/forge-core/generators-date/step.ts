import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const generatorsDateStep = step({
  path: '/generators-date',
  title: 'Dates',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Generators' },
  onAccess: [loadContent('generators-date')],
  blocks: [content],
})
