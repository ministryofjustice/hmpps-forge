import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const ticketPanelStep = step({
  path: '/ticket-panel',
  title: 'Ticket Panel',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('moj-ticket-panel')],
    }),
  ],
  blocks: [content],
})
