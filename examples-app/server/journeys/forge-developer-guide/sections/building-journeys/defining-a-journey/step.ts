import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const definingAJourneyStep = step({
  path: '/defining-a-journey',
  title: 'Defining a journey',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Building flows and content' },
  onAccess: [loadContent('defining-a-journey')],
  blocks: [content],
})
