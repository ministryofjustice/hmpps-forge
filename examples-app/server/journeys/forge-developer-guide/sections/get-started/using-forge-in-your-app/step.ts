import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const usingForgeInYourAppStep = step({
  path: '/using-forge-in-your-app',
  title: 'Using Forge in your app',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Setup guides' },
  onAccess: [loadContent('using-forge-in-your-app')],
  blocks: [content],
})
