import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const definitionsAndRuntimeStep = step({
  path: '/definitions-and-runtime',
  title: 'Definitions and runtime',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Working with data' },
  onAccess: [loadContent('definitions-and-runtime')],
  blocks: [content],
})
