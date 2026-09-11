import { submit, redirect, step, Self, Condition, Transformer, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import { saveDraftAnswers } from './effects'
import {
  GovUKTextInput,
  GovUKButton,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

const roleField = GovUKTextInput({
  code: 'role',
  label: {
    text: 'What is your role?',
    classes: GovUKUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  hint: { text: 'For example, developer, designer, or product manager.' },
  classes: GovUKUtilityClasses.Input.Width30,
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your role',
    }),
    validation({
      condition: Self().match(Condition.String.HasMaxLength(100)),
      message: 'Role must be 100 characters or less',
    }),
  ],
})

const continueButton = GovUKButton({ text: 'Continue' })

export const yourRoleStep = step({
  code: 'your-role',
  path: '/your-role',
  title: 'What is your role?',
  blocks: [roleField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [saveDraftAnswers()],
        // Last question — proceed to the summary page
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
