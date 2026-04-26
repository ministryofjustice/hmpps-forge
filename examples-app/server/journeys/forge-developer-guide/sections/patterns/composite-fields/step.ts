import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const compositeFieldsPatternStep = step({
  path: '/composite-fields',
  title: 'Multi-part composite fields',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Input and forms' },
  onAccess: [loadContent('patterns-composite-fields')],
  blocks: [content],
})
