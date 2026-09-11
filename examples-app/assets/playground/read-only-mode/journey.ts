import { journey, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { PatternDependencies } from './effects'
import { AnswerStore } from './AnswerStore'
import { overviewStep } from './overview'
import { loginStep } from './login'
import { contactsStep } from './contacts'
import { recordStep } from './record'

export const readOnlyModeDemoJourney = journey({
  code: 'read-only-mode-demo',
  title: 'Read-only mode',
  path: '/read-only-mode',
  steps: [overviewStep, loginStep, contactsStep, recordStep],
})

export const dependencies: PatternDependencies = { answerStore: new AnswerStore() }

export default createForgePackage<PatternDependencies>({ journey: readOnlyModeDemoJourney })
