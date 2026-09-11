import {
  Self,
  Data,
  Loop,
  Format,
  Condition,
  Transformer,
  Iterator,
  validation,
  submit,
  redirect,
  step,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKRadioInput,
  GovUKButton,
  GovUKLinkButton,
  GovUKUtilityClasses,
  GovUKButtonGroup,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveAnswers, clearDraftAnswers } from './effects'

const heading = GovUKHeading({
  text: 'Agree sentence plan',
  size: 'l',
  caption: 'Collection validation demo',
})

const intro = GovUKBody({
  text: `Review the plan below. You can only agree the plan when every
  active goal has at least one action assigned to it.`,
})

const agreePlanField = GovUKRadioInput({
  code: 'agreePlan',
  fieldset: {
    legend: {
      text: 'Do you agree this plan?',
      classes: GovUKUtilityClasses.Fieldset.MediumLabel,
    },
  },
  items: [
    { value: 'yes', text: 'Yes, I agree this plan' },
    { value: 'no', text: 'No, I do not agree this plan' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select whether you agree this plan',
    }),

    // There must be at least one active goal
    validation({
      condition: Data('goals').each(
        Iterator.Some(Loop.Item().path('status').match(Condition.Equals('ACTIVE'))),
      ),
      message: 'To agree the plan, create a goal to work on now',
    }),

    // Each active goal must have at least one action — produces a
    // separate error message per goal that is missing actions
    Data('goals')
      .each(Iterator.Filter(Loop.Item().path('status').match(Condition.Equals('ACTIVE'))))
      .each(
        Iterator.Map(
          validation({
            condition: Loop.Item()
              .path('actions')
              .pipe(Transformer.Array.Length())
              .match(Condition.Number.GreaterThan(0)),
            message: Format("Add actions to '%1'", Loop.Item().path('title')),
          }),
        ),
      ),
  ],
})

const continueButton = GovUKButton({ text: 'Continue' })

const manageGoalsLink = GovUKLinkButton({
  text: 'Add actions to goals',
  href: '/collection-validation/manage-plan',
  classes: 'govuk-button--secondary',
})

const buttonGroup = GovUKButtonGroup({
  buttons: [continueButton, manageGoalsLink],
})

export const agreePlanStep = step({
  code: 'agree-plan',
  path: '/agree-plan',
  title: 'Agree sentence plan',
  reachability: { entryWhen: true },
  blocks: [heading, intro, agreePlanField, buttonGroup],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          saveAnswers(),
          clearDraftAnswers(),
        ],
        next: [
          redirect({
            when: Data('savedAnswers').match(Condition.IsRequired()),
            goto: 'confirmation',
          }),
        ],
      },
    }),
  ],
})
