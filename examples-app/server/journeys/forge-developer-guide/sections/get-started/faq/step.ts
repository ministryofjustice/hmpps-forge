import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const faqStep = step({
  path: '/faq',
  title: 'Frequently asked questions',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Resources' },
  onAccess: [loadContent('faq')],
  blocks: [content],
})
