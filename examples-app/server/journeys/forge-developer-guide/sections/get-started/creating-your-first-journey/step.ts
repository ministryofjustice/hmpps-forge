import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const creatingYourFirstJourneyStep = step({
  path: '/creating-your-first-journey',
  title: 'Creating your first journey',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Setup guides' },
  onAccess: [loadContent('creating-your-first-journey')],
  blocks: [content],
})
