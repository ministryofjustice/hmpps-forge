import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const testingStep = step({
  path: '/testing',
  title: 'Testing',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Testing' },
  onAccess: [loadContent('testing')],
  blocks: [content],
})
