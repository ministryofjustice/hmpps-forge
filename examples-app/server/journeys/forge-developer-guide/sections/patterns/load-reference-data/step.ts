import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const loadReferenceDataPatternStep = step({
  path: '/load-reference-data',
  title: 'Load reference data on access',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Data and integrations' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('patterns-load-reference-data')],
    }),
  ],
  blocks: [content],
})
