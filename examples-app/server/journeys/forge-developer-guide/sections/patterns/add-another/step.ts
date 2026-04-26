import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const addAnotherPatternStep = step({
  path: '/add-another',
  title: 'Adding, editing and deleting from collections',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Collections' },
  onAccess: [loadContent('patterns-add-another')],
  blocks: [content],
})
