import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const notificationBadgeStep = step({
  path: '/notification-badge',
  title: 'Notification Badge',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('moj-notification-badge')],
    }),
  ],
  blocks: [content],
})
