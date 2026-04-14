import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const installFrontendLibrariesStep = step({
  path: '/install-frontend-libraries',
  title: 'Install frontend libraries',
  isEntryPoint: true,
  metadata: { navGroup: 'Setup guides' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('install-frontend-libraries')],
    }),
  ],
  blocks: [content],
})
