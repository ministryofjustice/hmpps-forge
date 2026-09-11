import {
  Self,
  Condition,
  validation,
  submit,
  redirect,
  Answer,
  and,
  step,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKTextareaInput,
  GovUKButton,
  GovUKHeading,
  GovUKBody,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { setAnswer, saveDraftAnswers } from './effects'

const heading = GovUKHeading({
  text: 'Do you have any additional needs?',
  size: 'l',
})

const hint = GovUKBody({
  text: 'Tell us about any accessibility requirements, dietary needs, or other support you need during your visit. Enter "None" if you have no additional needs.',
})

const additionalNeedsField = GovUKTextareaInput({
  code: 'additionalNeeds',
  label: {
    text: 'Additional needs',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  rows: 4,
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your additional needs or "None"',
      submissionOnly: true,
    }),
  ],
})

const continueButton = GovUKButton({ text: 'Save and return' })

// Only reachable once both preceding sections are complete
const prerequisitesMet = and(
  Answer('yourDetailsStatus').match(Condition.Equals('completed')),
  Answer('visitPreferencesStatus').match(Condition.Equals('completed')),
)

export const additionalNeedsStep = step({
  code: 'additional-needs',
  path: '/additional-needs',
  title: 'Additional needs',
  // Gated entry — blocks direct URL access until prerequisites are met
  reachability: { entryWhen: prerequisitesMet },
  backlink: 'tasks',
  blocks: [heading, hint, additionalNeedsField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          // Single-step section — goes straight to completed
          setAnswer('additionalNeedsStatus', 'completed'),
          saveDraftAnswers(),
        ],
        // Return to task list hub
        next: [redirect({ goto: 'tasks' })],
      },
    }),
  ],
})
