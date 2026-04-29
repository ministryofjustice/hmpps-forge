import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const buildingJourneysOverviewStep = step({
  path: '/overview',
  title: 'Building journeys',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  onAccess: [loadContent('building-journeys')],
  blocks: [content],
})
