import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const registeringAJourneyStep = step({
  path: '/registering-a-journey',
  title: 'Registering a journey',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Building flows and content' },
  onAccess: [loadContent('registering-a-journey')],
  blocks: [content],
})
