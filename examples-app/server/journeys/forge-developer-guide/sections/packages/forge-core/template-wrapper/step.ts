import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const templateWrapperStep = step({
  path: '/template-wrapper',
  title: 'TemplateWrapper',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [loadContent('template-wrapper')],
  blocks: [content],
})
