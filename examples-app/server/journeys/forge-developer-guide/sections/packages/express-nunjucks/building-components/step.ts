import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const expressNunjucksBuildingComponentsStep = step({
  path: '/building-components',
  title: 'Building Components',
  reachability: { entryWhen: true },
  onAccess: [loadContent('express-nunjucks-building-components')],
  blocks: [content],
})
