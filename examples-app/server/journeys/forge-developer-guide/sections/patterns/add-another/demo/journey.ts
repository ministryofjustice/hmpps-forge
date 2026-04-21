import { journey, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { PatternEffects } from '../../effects'
import { overviewStep } from './overview/step'
import { yourContactsStep } from './your-contacts/step'
import { addContactStep } from './add-contact/step'
import { editContactStep } from './edit-contact/step'
import { checkAnswersStep } from './check-answers/step'
import { confirmationStep } from './confirmation/step'

export const addAnotherDemoJourney = journey({
  code: 'add-another-demo',
  title: 'Add another',
  path: '/add-another',
  onAccess: [
    access({
      effects: [PatternEffects.LoadDraftAnswers('add-another')],
    }),
  ],
  steps: [
    overviewStep,
    yourContactsStep,
    addContactStep,
    editContactStep,
    checkAnswersStep,
    confirmationStep,
  ],
})
