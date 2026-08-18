import { GovUKTextInput, GovUKButton, GovUKRadioInput } from '@ministryofjustice/hmpps-forge/govuk-components'

import {
  journey,
  step,
  access,
  submit,
  redirect,
  validation,
  and,
  or,
  xor,
  not,
  Answer,
  Data,
  Format,
  Item,
  Iterator,
  Loop,
  Post,
  Self,
  Condition,
  Transformer,
} from '../../src/authoring'
import { CollectionBlock } from '../../src/components'
import { Effects } from './contractHelpers'

export const requiredFieldJourney = journey({
  code: 'required',
  path: '/required',
  title: 'Required field',
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'fullName',
          label: 'Full name',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your full name',
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

export const reachabilityDisabledValidationJourney = journey({
  code: 'reach-disabled-validation',
  path: '/reach-disabled-validation',
  title: 'Reachability Disabled Validation',
  reachability: { disableReachabilityChecks: true },
  onAccess: [access({ effects: [Effects.LoadAnswers('reach-disabled-validation')] })],
  steps: [
    step({
      path: '/start',
      title: 'Start',
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' }), GovUKButton({ text: 'Continue' })],
    }),
    step({
      path: '/date',
      title: 'Date',
      blocks: [
        GovUKTextInput({
          code: 'targetDate',
          label: 'Target date',
          validWhen: [
            validation({
              condition: Self().match(Condition.Date.IsToday()),
              message: 'Date must be today',
            }),
          ],
        }),
      ],
    }),
  ],
})

export const multipleRulesJourney = journey({
  code: 'multi-rules',
  path: '/multi-rules',
  title: 'Multiple validation rules',
  steps: [
    step({
      path: '/username',
      title: 'Username',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'username',
          label: 'Username',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter a username',
            }),
            validation({
              condition: Self().match(Condition.String.HasMinLength(3)),
              message: 'Username must be at least 3 characters',
            }),
            validation({
              condition: Self().match(Condition.String.HasMaxLength(10)),
              message: 'Username must be 10 characters or fewer',
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

export const dependentValidationJourney = journey({
  code: 'dep-valid',
  path: '/dep-valid',
  title: 'Dependent field validation',
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
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Select a contact method',
            }),
          ],
        }),
        GovUKTextInput({
          code: 'emailAddress',
          label: 'Email address',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter an email address',
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

export const crossFieldJourney = journey({
  code: 'cross-field',
  path: '/cross-field',
  title: 'Cross-field validation',
  steps: [
    step({
      path: '/passwords',
      title: 'Passwords',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'password',
          label: 'Password',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter a password',
            }),
          ],
        }),
        GovUKTextInput({
          code: 'confirmPassword',
          label: 'Confirm password',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Confirm your password',
            }),
            validation({
              condition: Self().match(Condition.Equals(Answer('password'))),
              message: 'Passwords must match',
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

export const domainValidationJourney = journey({
  code: 'domain',
  path: '/domain',
  title: 'Domain validation',
  steps: [
    step({
      path: '/range',
      title: 'Range',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({ code: 'minValue', label: 'Minimum' }),
        GovUKTextInput({ code: 'maxValue', label: 'Maximum' }),
        GovUKButton({ text: 'Continue' }),
      ],
      validWhen: [
        validation({
          condition: Answer('minValue').not.match(Condition.Equals(Answer('maxValue'))),
          message: 'Minimum and maximum must be different',
        }),
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

export const submissionOnlyJourney = journey({
  code: 'sub-only',
  path: '/sub-only',
  title: 'Submission-only validation',
  onAccess: [access({ effects: [Effects.LoadAnswers('sub-only')] })],
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'fullName',
          label: 'Full name',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your full name',
            }),
            validation({
              condition: Self().match(Condition.String.HasMinLength(3)),
              message: 'Name must be at least 3 characters',
              submissionOnly: true,
            }),
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      validateOnEntry: [{ groups: ['default'], when: true }],
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

export const validationGroupsJourney = journey({
  code: 'groups',
  path: '/groups',
  title: 'Validation groups',
  steps: [
    step({
      path: '/search',
      title: 'Search',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'searchQuery',
          label: 'Search',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter a search term',
              groups: ['search'],
            }),
          ],
        }),
        GovUKTextInput({
          code: 'filterTag',
          label: 'Filter tag',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter a filter tag',
              groups: ['filter'],
            }),
          ],
        }),
        GovUKButton({ text: 'Search' }),
        GovUKButton({ text: 'Filter' }),
      ],
      onSubmission: [
        submit({
          when: Post('action').match(Condition.Equals('search')),
          validate: { groups: ['search'] },
          onValid: {
            next: [redirect({ goto: 'done' })],
          },
        }),
        submit({
          when: Post('action').match(Condition.Equals('filter')),
          validate: { groups: ['filter'] },
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

export const iteratorValidationJourney = journey({
  code: 'iter-valid',
  path: '/iter-valid',
  title: 'Iterator validation',
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
                validWhen: [
                  validation({
                    condition: Self().match(Condition.IsRequired()),
                    message: 'Enter a name',
                  }),
                ],
              }),
            ]),
          ),
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

export const iteratorMultiRuleJourney = journey({
  code: 'iter-multi',
  path: '/iter-multi',
  title: 'Iterator multiple rules',
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
                validWhen: [
                  validation({
                    condition: Self().match(Condition.IsRequired()),
                    message: 'Enter a name',
                  }),
                  validation({
                    condition: Self().match(Condition.String.HasMinLength(2)),
                    message: 'Name must be at least 2 characters',
                  }),
                ],
              }),
            ]),
          ),
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

export const iteratorFormatterValidationJourney = journey({
  code: 'iter-fmt-valid',
  path: '/iter-fmt-valid',
  title: 'Iterator formatter then validation',
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
                formatters: [Transformer.String.Trim()],
                validWhen: [
                  validation({
                    condition: Self().match(Condition.String.HasMinLength(3)),
                    message: 'Name must be at least 3 characters',
                  }),
                ],
              }),
            ]),
          ),
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

export const nestedIteratorValidationJourney = journey({
  code: 'nested-iter-valid',
  path: '/nested-iter-valid',
  title: 'Nested iterator validation',
  onAccess: [access({ effects: [Effects.LoadData()] })],
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
                        validWhen: [
                          validation({
                            condition: Self().match(Condition.IsRequired()),
                            message: 'Enter a name',
                          }),
                        ],
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

export const formatterThenValidationJourney = journey({
  code: 'fmt-valid',
  path: '/fmt-valid',
  title: 'Formatter then validation',
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
              condition: Self().match(Condition.String.HasMinLength(3)),
              message: 'Name must be at least 3 characters',
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

export const detailsJourney = journey({
  code: 'details',
  path: '/details',
  title: 'Validation details',
  steps: [
    step({
      path: '/date',
      title: 'Date',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'dateOfBirth',
          label: 'Date of birth',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your date of birth',
              details: { field: 'day' },
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

export const entryValidationJourney = journey({
  code: 'entry-valid',
  path: '/entry-valid',
  title: 'Entry validation',
  onAccess: [access({ effects: [Effects.LoadAnswers('entry-valid')] })],
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'fullName',
          label: 'Full name',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your full name',
            }),
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      validateOnEntry: [{ groups: ['default'], when: true }],
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

export const onInvalidBranchJourney = journey({
  code: 'on-invalid',
  path: '/on-invalid',
  title: 'onInvalid branch',
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'fullName',
          label: 'Full name',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your full name',
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
          onInvalid: {
            next: [redirect({ goto: 'error' })],
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
    step({
      code: 'error',
      path: '/error',
      title: 'Error',
      blocks: [],
    }),
  ],
})

export const validateFalseJourney = journey({
  code: 'no-validate',
  path: '/no-validate',
  title: 'Validate false',
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'fullName',
          label: 'Full name',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your full name',
            }),
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('no-validate')],
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

export const emptyIteratorJourney = journey({
  code: 'empty-iter',
  path: '/empty-iter',
  title: 'Empty iterator validation',
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
                validWhen: [
                  validation({
                    condition: Self().match(Condition.IsRequired()),
                    message: 'Enter a name',
                  }),
                ],
              }),
            ]),
          ),
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

export const andCombinatorJourney = journey({
  code: 'and-comb',
  path: '/and-comb',
  title: 'And combinator',
  steps: [
    step({
      path: '/username',
      title: 'Username',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'username',
          label: 'Username',
          validWhen: [
            validation({
              condition: and(
                Self().match(Condition.String.HasMinLength(3)),
                Self().match(Condition.String.HasMaxLength(10)),
              ),
              message: 'Username must be 3-10 characters',
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

export const orCombinatorJourney = journey({
  code: 'or-comb',
  path: '/or-comb',
  title: 'Or combinator',
  steps: [
    step({
      path: '/contact',
      title: 'Contact',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({ code: 'email', label: 'Email' }),
        GovUKTextInput({ code: 'phone', label: 'Phone' }),
        GovUKButton({ text: 'Continue' }),
      ],
      validWhen: [
        validation({
          condition: or(Answer('email').match(Condition.IsRequired()), Answer('phone').match(Condition.IsRequired())),
          message: 'Enter either an email or phone number',
        }),
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

export const notCombinatorJourney = journey({
  code: 'not-comb',
  path: '/not-comb',
  title: 'Not combinator',
  steps: [
    step({
      path: '/value',
      title: 'Value',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'keyword',
          label: 'Keyword',
          validWhen: [
            validation({
              condition: not(Self().match(Condition.Equals('forbidden'))),
              message: 'Cannot use forbidden value',
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
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const xorCombinatorJourney = journey({
  code: 'xor-comb',
  path: '/xor-comb',
  title: 'Xor combinator',
  steps: [
    step({
      path: '/contact',
      title: 'Contact',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({ code: 'email', label: 'Email' }),
        GovUKTextInput({ code: 'phone', label: 'Phone' }),
        GovUKButton({ text: 'Continue' }),
      ],
      validWhen: [
        validation({
          condition: xor(Answer('email').match(Condition.IsRequired()), Answer('phone').match(Condition.IsRequired())),
          message: 'Enter either email or phone, but not both',
        }),
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
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const visibleWhenValidationJourney = journey({
  code: 'visible-valid',
  path: '/visible-valid',
  title: 'VisibleWhen does not skip validation',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'hiddenField',
          label: 'Hidden field',
          visibleWhen: false,
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'This field is required',
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
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const entryDomainValidationJourney = journey({
  code: 'entry-domain',
  path: '/entry-domain',
  title: 'Entry domain validation',
  onAccess: [access({ effects: [Effects.LoadAnswers('entry-domain')] })],
  steps: [
    step({
      path: '/range',
      title: 'Range',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({ code: 'minValue', label: 'Minimum' }),
        GovUKTextInput({ code: 'maxValue', label: 'Maximum' }),
        GovUKButton({ text: 'Continue' }),
      ],
      validWhen: [
        validation({
          condition: Answer('minValue').not.match(Condition.Equals(Answer('maxValue'))),
          message: 'Minimum and maximum must be different',
        }),
      ],
      validateOnEntry: [{ groups: ['default'], when: true }],
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

export const entryConditionalWhenFalseJourney = journey({
  code: 'entry-cond-false',
  path: '/entry-cond-false',
  title: 'Entry conditional when false',
  onAccess: [access({ effects: [Effects.LoadData(), Effects.LoadAnswers('entry-cond-false')] })],
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'fullName',
          label: 'Full name',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your full name',
            }),
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      validateOnEntry: [{ groups: ['default'], when: Data('shouldValidate').match(Condition.Equals(true)) }],
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

// One logical field rendered as several same-code copies, each owned by a
// different parent answer via dependentWhen. The first active copy in
// declaration order owns validation; the error anchor comes from the copy's id.
function employedCopy(parentValue: string, id: string) {
  return GovUKTextInput({
    code: 'has_been_employed',
    label: 'Have they been employed before?',
    id,
    dependentWhen: Answer('employment_status').match(Condition.Equals(parentValue)),
    validWhen: [
      validation({
        condition: Self().match(Condition.IsRequired()),
        message: 'Select whether they have been employed before',
      }),
    ],
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
        employedCopy('unavailable', 'employed-unavailable'),
        employedCopy('actively-seeking', 'employed-actively-seeking'),
        employedCopy('not-actively-seeking', 'employed-not-actively-seeking'),
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
