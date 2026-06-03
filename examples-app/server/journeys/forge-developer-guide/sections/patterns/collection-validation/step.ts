import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const collectionValidationPatternStep = step({
  path: '/collection-validation',
  title: 'Validating collections with iterators',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Validation' },
  onAccess: [loadContent('patterns-collection-validation')],
  blocks: [content],
})
