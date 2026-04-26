import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from './blocks'

export const definingBlocksAndFieldsStep = step({
  path: '/defining-blocks-and-fields',
  title: 'Defining blocks and fields',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Building flows and content' },
  onAccess: [loadContent('defining-blocks-and-fields')],
  blocks: [content],
})
