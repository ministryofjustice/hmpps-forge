import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const notificationBannerStep = step({
  path: '/notification-banner',
  title: 'Notification Banner',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('govuk-notification-banner')],
    }),
  ],
  blocks: [content],
})
