import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const datePickerStep = step({
  path: '/date-picker',
  title: 'Date Picker',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('moj-date-picker')],
    }),
  ],
  blocks: [content],
})
