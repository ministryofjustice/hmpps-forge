import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const expressNunjucksRequestStateStep = step({
  path: '/request-state',
  title: 'Request & State',
  reachability: { entryWhen: true },
  onAccess: [loadContent('express-nunjucks-request-state')],
  blocks: [content],
})
