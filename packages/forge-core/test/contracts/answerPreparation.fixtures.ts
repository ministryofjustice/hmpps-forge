import {
  GovUKCheckboxInput,
  GovUKTextInput,
  GovUKButton,
  GovUKRadioInput,
  GovUKDateInputFull,
} from '@ministryofjustice/hmpps-forge/govuk-components'

import {
  journey,
  step,
  access,
  submit,
  redirect,
  validation,
  Answer,
  Data,
  Format,
  Item,
  Iterator,
  Loop,
  Self,
  Condition,
  Transformer,
} from '../../src/authoring'
import { CollectionBlock } from '../../src/components'
import { Effects } from './contractHelpers'

export const storeValuesJourney = journey({
  code: 'store-values',
  path: '/store-values',
  title: 'Store values',
  onAccess: [access({ effects: [Effects.LoadAnswers('store-values')] })],
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'fullName', label: 'Full name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('store-values')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const formattersJourney = journey({
  code: 'formatters',
  path: '/formatters',
  title: 'Formatters',
  onAccess: [access({ effects: [Effects.LoadAnswers('formatters')] })],
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'fullName',
          label: 'Full name',
          formatters: [Transformer.String.Trim(), Transformer.String.ToTitleCase()],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('formatters')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const formattersWithValidationJourney = journey({
  code: 'format-validate',
  path: '/format-validate',
  title: 'Format then validate',
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'fullName',
          label: 'Full name',
          formatters: [Transformer.String.Trim()],
          validWhen: [
            validation({
              condition: Self().match(Condition.String.HasMaxLength(3)),
              message: 'Name must be 3 characters or fewer',
            }),
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const parserJourney = journey({
  code: 'parsers',
  path: '/parsers',
  title: 'Parsers',
  onAccess: [access({ effects: [Effects.LoadAnswers('parsers')] })],
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'fullName',
          label: 'Full name',
          parsers: [Transformer.String.ToUpperCase()],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
    }),
  ],
})

export const defaultValueJourney = journey({
  code: 'defaults',
  path: '/defaults',
  title: 'Default value',
  onAccess: [access({ effects: [Effects.LoadAnswers('defaults')] })],
  steps: [
    step({
      path: '/country',
      title: 'Country',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'country',
          label: 'Country',
          defaultValue: 'United Kingdom',
        }),
        GovUKButton({ text: 'Continue' }),
      ],
    }),
  ],
})

export const dependentWhenJourney = journey({
  code: 'dependent',
  path: '/dependent',
  title: 'Dependent field clearing',
  onAccess: [access({ effects: [Effects.LoadAnswers('dependent')] })],
  steps: [
    step({
      path: '/contact',
      title: 'Contact',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'contactMethod',
          fieldset: { legend: { text: 'How should we contact you?' } },
          items: [
            { value: 'email', text: 'Email' },
            { value: 'phone', text: 'Phone' },
          ],
        }),
        GovUKTextInput({
          code: 'emailAddress',
          label: 'Email address',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('dependent')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const typeErrorJourney = journey({
  code: 'type-error',
  path: '/type-error',
  title: 'Formatter type error',
  steps: [
    step({
      path: '/age',
      title: 'Age',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'age',
          label: 'Age',
          formatters: [Transformer.String.ToInt()],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('type-error')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const iteratorJourney = journey({
  code: 'iterator',
  path: '/iterator',
  title: 'Iterator fields',
  onAccess: [access({ effects: [Effects.LoadData(), Effects.LoadAnswers('iterator')] })],
  steps: [
    step({
      path: '/members',
      title: 'Members',
      reachability: { entryWhen: true },
      blocks: [
        CollectionBlock({
          collection: Data('members').each(
            Iterator.Map([
              GovUKTextInput({
                code: Format('memberName_%1', Loop.Index0()),
                label: 'Name',
              }),
            ]),
          ),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('iterator')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const iteratorFormatJourney = journey({
  code: 'iter-format',
  path: '/iter-format',
  title: 'Iterator formatters',
  onAccess: [access({ effects: [Effects.LoadData(), Effects.LoadAnswers('iter-format')] })],
  steps: [
    step({
      path: '/members',
      title: 'Members',
      reachability: { entryWhen: true },
      blocks: [
        CollectionBlock({
          collection: Data('members').each(
            Iterator.Map([
              GovUKTextInput({
                code: Format('memberName_%1', Loop.Index0()),
                label: 'Name',
                formatters: [Transformer.String.Trim(), Transformer.String.ToTitleCase()],
              }),
            ]),
          ),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('iter-format')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const iteratorDefaultJourney = journey({
  code: 'iter-default',
  path: '/iter-default',
  title: 'Iterator defaults',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/members',
      title: 'Members',
      reachability: { entryWhen: true },
      blocks: [
        CollectionBlock({
          collection: Data('members').each(
            Iterator.Map([
              GovUKTextInput({
                code: Format('memberName_%1', Loop.Index0()),
                label: 'Name',
                defaultValue: Item().path('name'),
              }),
            ]),
          ),
        }),
      ],
    }),
  ],
})

export const nestedIteratorJourney = journey({
  code: 'nested-iter',
  path: '/nested-iter',
  title: 'Nested iterators',
  onAccess: [access({ effects: [Effects.LoadData(), Effects.LoadAnswers('nested-iter')] })],
  steps: [
    step({
      path: '/teams',
      title: 'Teams',
      reachability: { entryWhen: true },
      blocks: [
        CollectionBlock({
          collection: Data('teams').each(
            Iterator.Map([
              CollectionBlock({
                collection: Item()
                  .path('members')
                  .each(
                    Iterator.Map([
                      GovUKTextInput({
                        code: Format('team_%1_member_%2', Loop.Parent.Index0(), Loop.Index0()),
                        label: 'Name',
                      }),
                    ]),
                  ),
              }),
            ]),
          ),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('nested-iter')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const checkboxJourney = journey({
  code: 'checkbox',
  path: '/checkbox',
  title: 'Checkbox',
  steps: [
    step({
      path: '/preferences',
      title: 'Preferences',
      reachability: { entryWhen: true },
      blocks: [
        GovUKCheckboxInput({
          code: 'colors',
          fieldset: { legend: { text: 'Favourite colours' } },
          items: [
            { value: 'red', text: 'Red' },
            { value: 'blue', text: 'Blue' },
            { value: 'green', text: 'Green' },
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('checkbox')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const parserAndFormatterJourney = journey({
  code: 'parser-fmt',
  path: '/parser-fmt',
  title: 'Parser and formatter',
  onAccess: [access({ effects: [Effects.LoadAnswers('parser-fmt')] })],
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'fullName',
          label: 'Full name',
          formatters: [Transformer.String.Trim()],
          parsers: [Transformer.String.ToUpperCase()],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('parser-fmt')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const defaultValuePostJourney = journey({
  code: 'default-post',
  path: '/default-post',
  title: 'Default value on POST',
  steps: [
    step({
      path: '/country',
      title: 'Country',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'country',
          label: 'Country',
          defaultValue: 'United Kingdom',
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('default-post')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const chainedFormatterTypeErrorJourney = journey({
  code: 'chained-err',
  path: '/chained-err',
  title: 'Chained formatter TypeError',
  steps: [
    step({
      path: '/value',
      title: 'Value',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'amount',
          label: 'Amount',
          formatters: [Transformer.String.Trim(), Transformer.String.ToInt()],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('chained-err')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const defaultWithParserJourney = journey({
  code: 'default-parser',
  path: '/default-parser',
  title: 'Default with parser',
  onAccess: [access({ effects: [Effects.LoadAnswers('default-parser')] })],
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'fullName',
          label: 'Full name',
          defaultValue: 'ada lovelace',
          parsers: [Transformer.String.ToUpperCase()],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
    }),
  ],
})

export const iteratorDependentWhenJourney = journey({
  code: 'iter-dep',
  path: '/iter-dep',
  title: 'Iterator dependentWhen',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/members',
      title: 'Members',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'showDetails',
          fieldset: { legend: { text: 'Show details?' } },
          items: [
            { value: 'yes', text: 'Yes' },
            { value: 'no', text: 'No' },
          ],
        }),
        CollectionBlock({
          collection: Data('members').each(
            Iterator.Map([
              GovUKTextInput({
                code: Format('memberName_%1', Loop.Index0()),
                label: 'Name',
                dependentWhen: Answer('showDetails').match(Condition.Equals('yes')),
              }),
            ]),
          ),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('iter-dep')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const checkboxMultiJourney = journey({
  code: 'checkbox-multi',
  path: '/checkbox-multi',
  title: 'Checkbox multi',
  steps: [
    step({
      path: '/preferences',
      title: 'Preferences',
      reachability: { entryWhen: true },
      blocks: [
        GovUKCheckboxInput({
          code: 'colors',
          fieldset: { legend: { text: 'Favourite colours' } },
          items: [
            { value: 'red', text: 'Red' },
            { value: 'blue', text: 'Blue' },
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('checkbox-multi')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const emptyMultipleCheckboxJourney = journey({
  code: 'empty-multi',
  path: '/empty-multi',
  title: 'Empty multiple checkbox',
  steps: [
    step({
      path: '/preferences',
      title: 'Preferences',
      reachability: { entryWhen: true },
      blocks: [
        GovUKCheckboxInput({
          code: 'colors',
          fieldset: { legend: { text: 'Favourite colours' } },
          items: [
            { value: 'red', text: 'Red' },
            { value: 'blue', text: 'Blue' },
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('empty-multi')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const dependentWhenWithDefaultJourney = journey({
  code: 'dep-default',
  path: '/dep-default',
  title: 'DependentWhen with default reseed',
  onAccess: [access({ effects: [Effects.LoadAnswers('dep-default')] })],
  steps: [
    step({
      path: '/contact',
      title: 'Contact',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'contactMethod',
          fieldset: { legend: { text: 'How should we contact you?' } },
          items: [
            { value: 'email', text: 'Email' },
            { value: 'phone', text: 'Phone' },
          ],
        }),
        GovUKTextInput({
          code: 'emailAddress',
          label: 'Email address',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
          defaultValue: 'default@example.com',
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('dep-default')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const parserTypeErrorJourney = journey({
  code: 'parser-err',
  path: '/parser-err',
  title: 'Parser TypeError on GET',
  onAccess: [access({ effects: [Effects.LoadAnswers('parser-err')] })],
  steps: [
    step({
      path: '/age',
      title: 'Age',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'age',
          label: 'Age',
          parsers: [Transformer.String.ToInt()],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
    }),
  ],
})

export const arrayNonMultipleJourney = journey({
  code: 'array-non-multiple',
  path: '/array-non-multiple',
  title: 'Array for non-multiple field',
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'fieldCode', label: 'Field' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('array-non-multiple')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

export const dateInputJourney = journey({
  code: 'date-input',
  path: '/date-input',
  title: 'Date input',
  steps: [
    step({
      path: '/dob',
      title: 'Date of birth',
      reachability: { entryWhen: true },
      blocks: [GovUKDateInputFull({ code: 'dob', label: 'Date of birth' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('date-input')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

// One logical field rendered as several same-code copies, each owned by a
// different parent answer via dependentWhen. The first active copy in
// declaration order owns answer preparation; with no copy active the shared
// answer is cleared once, not once per copy.
function employedCopy(parentValue: string) {
  return GovUKTextInput({
    code: 'has_been_employed',
    label: 'Have they been employed before?',
    dependentWhen: Answer('employment_status').match(Condition.Equals(parentValue)),
  })
}

export const sameCodeVariantsJourney = journey({
  code: 'same-code',
  path: '/same-code',
  title: 'Same-code field variants',
  steps: [
    step({
      path: '/employment',
      title: 'Employment',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'employment_status',
          fieldset: { legend: { text: 'Employment status' } },
          items: [
            { value: 'unavailable', text: 'Unavailable' },
            { value: 'actively-seeking', text: 'Actively seeking' },
            { value: 'not-actively-seeking', text: 'Not actively seeking' },
            { value: 'employed', text: 'Employed' },
          ],
        }),
        employedCopy('unavailable'),
        employedCopy('actively-seeking'),
        employedCopy('not-actively-seeking'),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('same-code')],
          },
        }),
      ],
    }),
  ],
})
