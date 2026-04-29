import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const loadReferenceDataPatternStep = step({
  path: '/load-reference-data',
  title: 'Load reference data on access',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Data and integrations' },
  onAccess: [loadContent('patterns-load-reference-data')],
  blocks: [content],
})
