import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const installingForgeStep = step({
  path: '/installing-forge',
  title: 'Installing Forge',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Setup guides' },
  onAccess: [loadContent('installing-forge')],
  blocks: [content],
})
