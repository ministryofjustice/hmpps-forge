import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const expressNunjucksOverviewStep = step({
  path: '/overview',
  title: 'Express-Nunjucks Adapter',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  onAccess: [loadContent('express-nunjucks')],
  blocks: [content],
})
