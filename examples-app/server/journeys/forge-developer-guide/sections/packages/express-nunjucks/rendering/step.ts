import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const expressNunjucksRenderingStep = step({
  path: '/rendering',
  title: 'Rendering',
  reachability: { entryWhen: true },
  onAccess: [loadContent('express-nunjucks-rendering')],
  blocks: [content],
})
