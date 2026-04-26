import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const installFrontendLibrariesStep = step({
  path: '/install-frontend-libraries',
  title: 'Install frontend libraries',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Setup guides' },
  onAccess: [loadContent('install-frontend-libraries')],
  blocks: [content],
})
