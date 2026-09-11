import {
  Data,
  Format,
  Iterator,
  Loop,
  Self,
  Condition,
  Transformer,
  validation,
  submit,
  redirect,
  Post,
  step,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKTextInput,
  GovUKButton,
  GovUKButtonGroup,
  GovUKHeading,
  GovUKInsetText,
  GovUKUtilityClasses,
  GovUKSectionBreak,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { addHouseholdMember, removeHouseholdMember, saveHouseholdMembers } from './effects'

const heading = GovUKHeading({
  text: 'Household members',
  size: 'l',
})

const memberRows = CollectionBlock({
  collection: Data('members').each(
    Iterator.Map([
      GovUKTextInput({
        code: Format('memberName_%1', Loop.Index0()),
        label: { text: 'Name' },
        defaultValue: Loop.Item().path('memberName'),
        classes: GovUKUtilityClasses.Input.Width20,
        formatters: [Transformer.String.Trim()],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter a name',
          }),
        ],
      }),
      GovUKTextInput({
        code: Format('memberAge_%1', Loop.Index0()),
        label: { text: 'Age' },
        formatters: [Transformer.String.ToInt()],
        defaultValue: Loop.Item().path('memberAge'),
        classes: GovUKUtilityClasses.Input.Width5,
        inputMode: 'numeric',
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter an age',
          }),
          validation({
            condition: Self().match(Condition.Number.IsNumber()),
            message: 'Enter a number',
          }),
        ],
      }),
      GovUKButton({
        text: 'Remove',
        name: 'action',
        value: Format('remove_%1', Loop.Index0()),
        classes: 'govuk-button--warning',
      }),
      GovUKSectionBreak({ size: 'l', visible: true }),
    ]),
  ),
  fallback: [GovUKInsetText({ text: 'You have not added any household members yet.' })],
})

const buttonGroup = GovUKButtonGroup({
  buttons: [
    GovUKButton({
      text: 'Add another person',
      name: 'action',
      value: 'add-another',
      classes: 'govuk-button--secondary',
    }),
    GovUKButton({
      text: 'Continue',
      name: 'action',
      value: 'continue',
    }),
  ],
})

export const householdMembersStep = step({
  code: 'household-members',
  path: '/household-members',
  title: 'Household members',
  reachability: { entryWhen: true },
  blocks: [heading, memberRows, buttonGroup],
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('add-another')),
      validate: false,
      onAlways: {
        effects: [addHouseholdMember()],
      },
    }),
    submit({
      when: Post('action').match(Condition.String.StartsWith('remove_')),
      validate: false,
      onAlways: {
        effects: [removeHouseholdMember()],
      },
    }),
    submit({
      when: Post('action').match(Condition.Equals('continue')),
      validate: true,
      onValid: {
        effects: [saveHouseholdMembers()],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
  // Step-level validation — requires at least one household member before the user
  // can continue. Also feeds into reachability: downstream steps are
  // unreachable while this rule fails.
  validWhen: [
    validation({
      condition: Data('members').match(Condition.IsRequired()),
      message: 'Add at least one household member',
    }),
  ],
})
