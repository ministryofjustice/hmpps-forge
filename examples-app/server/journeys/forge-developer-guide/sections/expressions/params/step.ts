import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const paramsStep = step({
  path: '/params',
  title: 'Params',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'References' },
  onAccess: [loadContent('params')],
  blocks: [content],
})
