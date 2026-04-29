import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const whyUseForgeStep = step({
  path: '/why-use-forge',
  title: 'Why use Forge',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Setup guides' },
  onAccess: [loadContent('why-use-forge')],
  blocks: [content],
})
