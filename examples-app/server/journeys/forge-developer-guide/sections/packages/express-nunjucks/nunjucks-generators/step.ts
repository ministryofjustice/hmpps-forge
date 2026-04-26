import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const expressNunjucksGeneratorsStep = step({
  path: '/nunjucks-generators',
  title: 'Nunjucks Generators',
  reachability: { entryWhen: true },
  onAccess: [loadContent('express-nunjucks-generators')],
  blocks: [content],
})
