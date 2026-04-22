import {
  Data,
  Format,
  Item,
  Iterator,
  Self,
  Condition,
  Transformer,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKTextInput,
  GovUKButton,
  GovUKButtonGroup,
  GovUKHeading,
  GovUKInsetText,
  GovukUtilityClasses,
  GovUKSectionBreak,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Household members',
  size: 'l',
})

// TODO: TemplateWrapper version kept for comparison — remove once array approach is confirmed
// export const memberRows = CollectionBlock({
//   collection: Data('members').each(
//     Iterator.Map(
//       TemplateWrapper({
//         template: '<div>{{slot:name}}{{slot:age}}{{slot:remove}}{{slot:break}}</div>',
//         slots: {
//           name: [
//             GovUKTextInput({
//               code: Format('memberName_%1', Item().index()),
//               label: { text: 'Name' },
//               defaultValue: Item().path('memberName'),
//               classes: GovukUtilityClasses.Input.Width20,
//               formatters: [Transformer.String.Trim()],
//               validWhen: [
//                 validation({
//                   condition: Self().match(Condition.IsRequired()),
//                   message: 'Enter a name',
//                 }),
//               ],
//             }),
//           ],
//           age: [
//             GovUKTextInput({
//               code: Format('memberAge_%1', Item().index()),
//               label: { text: 'Age' },
//               defaultValue: Item().path('memberAge'),
//               classes: GovukUtilityClasses.Input.Width5,
//               inputMode: 'numeric',
//               validWhen: [
//                 validation({
//                   condition: Self().match(Condition.IsRequired()),
//                   message: 'Enter an age',
//                 }),
//                 validation({
//                   condition: Self().match(Condition.Number.IsNumber()),
//                   message: 'Enter a number',
//                 }),
//               ],
//             }),
//           ],
//           remove: [
//             GovUKButton({
//               text: 'Remove',
//               name: 'action',
//               value: Format('remove_%1', Item().index()),
//               classes: 'govuk-button--warning',
//             }),
//           ],
//           break: [GovUKSectionBreak({ size: 'l', visible: true })],
//         },
//       }),
//     ),
//   ),
//   fallback: [GovUKInsetText({ text: 'You have not added any household members yet.' })],
// })

export const memberRows = CollectionBlock({
  collection: Data('members').each(
    Iterator.Map([
      GovUKTextInput({
        code: Format('memberName_%1', Item().index()),
        label: { text: 'Name' },
        defaultValue: Item().path('memberName'),
        classes: GovukUtilityClasses.Input.Width20,
        formatters: [Transformer.String.Trim()],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter a name',
          }),
        ],
      }),
      GovUKTextInput({
        code: Format('memberAge_%1', Item().index()),
        label: { text: 'Age' },
        formatters: [Transformer.String.ToInt()],
        defaultValue: Item().path('memberAge'),
        classes: GovukUtilityClasses.Input.Width5,
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
        value: Format('remove_%1', Item().index()),
        classes: 'govuk-button--warning',
      }),
      GovUKSectionBreak({ size: 'l', visible: true }),
    ]),
  ),
  fallback: [GovUKInsetText({ text: 'You have not added any household members yet.' })],
})

export const buttonGroup = GovUKButtonGroup({
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
