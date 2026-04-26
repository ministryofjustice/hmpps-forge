import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const preFillPatternStep = step({
  path: '/pre-fill',
  title: 'Pre-fill from an external system',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Data and integrations' },
  onAccess: [loadContent('patterns-pre-fill')],
  blocks: [content],
})
