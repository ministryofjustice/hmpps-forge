import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const htmlBlockStep = step({
  path: '/html-block',
  title: 'HtmlBlock',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [loadContent('html-block')],
  blocks: [content],
})
