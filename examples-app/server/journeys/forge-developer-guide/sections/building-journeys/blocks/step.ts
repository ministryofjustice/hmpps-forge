import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from './blocks'

export const definingBlocksAndFieldsStep = step({
  path: '/defining-blocks-and-fields',
  title: 'Defining blocks and fields',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Building flows and content' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('defining-blocks-and-fields')],
    }),
  ],
  blocks: [content],
})
