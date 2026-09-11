import { journey, access, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadDraftAnswers, loadSavedAnswers } from './effects'
import type { PatternDependencies } from './effects'
import { AnswerStore } from './AnswerStore'
import { overviewStep } from './overview'
import { yourContactsStep } from './your-contacts'
import { addContactStep } from './add-contact'
import { editContactStep } from './edit-contact'
import { deleteContactStep } from './delete-contact'
import { checkAnswersStep } from './check-answers'
import { confirmationStep } from './confirmation'

export const addAnotherDemoJourney = journey({
  code: 'add-another-demo',
  title: 'Adding, editing and deleting from collections',
  path: '/add-another',
  onAccess: [
    access({
      effects: [loadDraftAnswers(), loadSavedAnswers()],
    }),
  ],
  steps: [
    overviewStep,
    yourContactsStep,
    addContactStep,
    editContactStep,
    deleteContactStep,
    checkAnswersStep,
    confirmationStep,
  ],
})

export const dependencies: PatternDependencies = { answerStore: new AnswerStore() }

export default createForgePackage<PatternDependencies>({ journey: addAnotherDemoJourney })
