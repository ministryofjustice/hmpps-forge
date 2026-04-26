import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const validationStep = step({
  path: '/validation',
  title: 'Validation',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Working with data' },
  onAccess: [loadContent('validation')],
  blocks: [content],
})
