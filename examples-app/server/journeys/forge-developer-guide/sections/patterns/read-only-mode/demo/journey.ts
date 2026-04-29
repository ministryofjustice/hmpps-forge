import { journey, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { PatternEffects } from '../../effects'
import { overviewStep } from './overview/step'
import { loginStep } from './login/step'
import { contactsStep } from './contacts/step'
import { recordStep } from './record/step'

export const readOnlyModeDemoJourney = journey({
  code: 'read-only-mode-demo',
  title: 'Read-only mode',
  path: '/read-only-mode',
  onAccess: [
    access({
      effects: [PatternEffects.LoadDraftAnswers('read-only-mode')],
    }),
  ],
  steps: [overviewStep, loginStep, contactsStep, recordStep],
})
