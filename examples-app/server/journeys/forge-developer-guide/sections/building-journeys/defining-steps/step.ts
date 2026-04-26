import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const definingStepsStep = step({
  path: '/defining-steps',
  title: 'Defining steps',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Building flows and content' },
  onAccess: [loadContent('defining-steps')],
  blocks: [content],
})
