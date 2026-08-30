import {
  redirect,
  submit,
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
} from '../../../../src/authoring'
import { CollectionBlock } from '../../../../src/components'
import type { StepContractCase } from '../../contractRunner'
import { TextField } from '../../testComponents'
import { FixedText, EqualsValue, LengthBetween, AppendSuffix } from './validation.fixtures'

function requiredField(code: string, message: string) {
  return TextField({
    code,
    validWhen: [
      validation({
        condition: Self().match(Condition.IsRequired()),
        message,
      }),
    ],
  })
}

function memberNameCollection(rules: ReturnType<typeof validation>[]) {
  return CollectionBlock({
    collection: Data('members').each(
      Iterator.Map([
        TextField({
          code: Format('memberName_%1', Loop.Index0()),
          validWhen: rules,
        }),
      ]),
    ),
  })
}

function employedCopy(parentValue: string, id: string) {
  return TextField({
    code: 'has_been_employed',
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

const twoMembers = { data: { members: [{ name: 'Ada' }, { name: 'Grace' }] } }

export const cases: StepContractCase[] = [
  {
    description: 'field validation',
    step: { blocks: [requiredField('fullName', 'Enter your full name')] },
    tests: [
      {
        name: 'should fail validation when required field is empty',
        post: { fullName: '' },
        showFailures: true,
        errors: { fullName: ['Enter your full name'] },
      },
      {
        name: 'should pass validation and redirect when required field is present',
        post: { fullName: 'Ada Lovelace' },
        valid: true,
      },
      {
        name: 'should produce validation errors on POST without validateOnEntry',
        post: { fullName: '' },
        showFailures: true,
        errors: { fullName: [{ message: 'Enter your full name', passed: false }] },
      },
      {
        name: 'should include blockCode, passed, message, and submissionOnly in error',
        post: { fullName: '' },
        errors: {
          fullName: [{ blockCode: 'fullName', passed: false, message: 'Enter your full name', submissionOnly: false }],
        },
      },
    ],
  },
  {
    description: 'multiple rules per field',
    step: {
      blocks: [
        TextField({
          code: 'username',
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
      ],
    },
    tests: [
      {
        name: 'should collect all failing rules, not stop at first',
        post: { username: '' },
        errors: { username: ['Enter a username', 'Username must be at least 3 characters'] },
      },
      {
        name: 'should only fail rules whose conditions are not met',
        post: { username: 'ab' },
        errors: { username: ['Username must be at least 3 characters'] },
      },
    ],
  },
  {
    description: 'formatted value validation',
    step: {
      blocks: [
        TextField({
          code: 'fullName',
          formatters: [Transformer.String.Trim()],
          validWhen: [
            validation({
              condition: Self().match(Condition.String.HasMinLength(3)),
              message: 'Name must be at least 3 characters',
            }),
          ],
        }),
      ],
    },
    tests: [
      {
        name: 'should validate formatted value, not raw submission',
        post: { fullName: '  ab  ' },
        errors: { fullName: ['Name must be at least 3 characters'] },
      },
      {
        name: 'should pass validation when formatted value satisfies rule',
        post: { fullName: '  Ada  ' },
        valid: true,
      },
    ],
  },
  {
    description: 'validation error details',
    step: {
      blocks: [
        TextField({
          code: 'dateOfBirth',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your date of birth',
              details: { field: 'day' },
            }),
          ],
        }),
      ],
    },
    tests: [
      {
        name: 'should include details property in validation error',
        post: { dateOfBirth: '' },
        errors: { dateOfBirth: [{ message: 'Enter your date of birth', details: { field: 'day' } }] },
      },
    ],
  },
  {
    description: 'dependentWhen interaction',
    step: {
      blocks: [
        TextField({
          code: 'contactMethod',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Select a contact method',
            }),
          ],
        }),
        TextField({
          code: 'emailAddress',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter an email address',
            }),
          ],
        }),
      ],
    },
    tests: [
      {
        name: 'should skip validation for hidden dependent fields',
        post: { contactMethod: 'phone', emailAddress: '' },
        valid: true,
      },
      {
        name: 'should validate visible dependent fields',
        post: { contactMethod: 'email', emailAddress: '' },
        errors: { emailAddress: ['Enter an email address'] },
      },
    ],
  },
  {
    // One logical field rendered as several same-code copies, each owned by a
    // different parent answer via dependentWhen. The first active copy in
    // declaration order owns validation; the error anchor comes from the copy's id.
    description: 'same-code field variants',
    step: {
      blocks: [
        TextField({ code: 'employment_status' }),
        employedCopy('unavailable', 'employed-unavailable'),
        employedCopy('actively-seeking', 'employed-actively-seeking'),
        employedCopy('not-actively-seeking', 'employed-not-actively-seeking'),
      ],
    },
    tests: [
      {
        name: 'should fail only the active copy and anchor the error to its id',
        post: { employment_status: 'not-actively-seeking' },
        errors: {
          has_been_employed: [
            { message: 'Select whether they have been employed before', anchor: 'employed-not-actively-seeking' },
          ],
        },
      },
      {
        name: 'should pass validation and redirect when the active copy has an answer',
        post: { employment_status: 'actively-seeking', has_been_employed: 'no' },
        valid: true,
      },
    ],
  },
  {
    description: 'cross-field validation',
    step: {
      blocks: [
        requiredField('password', 'Enter a password'),
        TextField({
          code: 'confirmPassword',
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
      ],
    },
    tests: [
      {
        name: 'should validate a field against another field value',
        post: { password: 'secret', confirmPassword: 'different' },
        errors: { confirmPassword: ['Passwords must match'] },
      },
      {
        name: 'should pass when cross-field values match',
        post: { password: 'secret', confirmPassword: 'secret' },
        valid: true,
      },
    ],
  },
  {
    description: 'domain validation',
    step: {
      blocks: [TextField({ code: 'minValue' }), TextField({ code: 'maxValue' })],
      validWhen: [
        validation({
          condition: Answer('minValue').not.match(Condition.Equals(Answer('maxValue'))),
          message: 'Minimum and maximum must be different',
        }),
      ],
    },
    tests: [
      {
        name: 'should surface step-level validation as domain errors',
        post: { minValue: '10', maxValue: '10' },
        domainErrors: ['Minimum and maximum must be different'],
        errors: {},
      },
      {
        name: 'should pass domain validation when step-level condition is met',
        post: { minValue: '5', maxValue: '10' },
        valid: true,
      },
    ],
  },
  {
    description: 'submissionOnly rules',
    step: {
      blocks: [
        TextField({
          code: 'fullName',
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
      ],
      validateOnEntry: [{ groups: ['default'], when: true }],
    },
    tests: [
      {
        name: 'should skip submissionOnly rules on entry validation',
        session: { answers: { fullName: 'AB' } },
        showFailures: true,
        errors: { fullName: [] },
      },
      {
        name: 'should show only non-submissionOnly failures on entry validation',
        session: { answers: { fullName: '' } },
        showFailures: true,
        errors: { fullName: ['Enter your full name'] },
      },
      {
        name: 'should run submissionOnly rules on POST',
        post: { fullName: 'AB' },
        errors: { fullName: ['Name must be at least 3 characters'] },
      },
    ],
  },
  {
    description: 'validation groups',
    step: {
      blocks: [
        TextField({
          code: 'searchQuery',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter a search term',
              groups: ['search'],
            }),
          ],
        }),
        TextField({
          code: 'filterTag',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter a filter tag',
              groups: ['filter'],
            }),
          ],
        }),
      ],
      onSubmission: [
        submit({
          when: Post('action').match(Condition.Equals('search')),
          validate: { groups: ['search'] },
          onValid: { next: [redirect({ goto: 'done' })] },
        }),
        submit({
          when: Post('action').match(Condition.Equals('filter')),
          validate: { groups: ['filter'] },
          onValid: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    },
    tests: [
      {
        name: 'should only validate fields in the triggered group',
        post: { action: 'search', searchQuery: '', filterTag: '' },
        errors: { searchQuery: ['Enter a search term'], filterTag: [] },
      },
      {
        name: 'should validate a different group when triggered by its hook',
        post: { action: 'filter', searchQuery: '', filterTag: '' },
        errors: { searchQuery: [], filterTag: ['Enter a filter tag'] },
      },
    ],
  },
  {
    description: 'entry validation of domain rules',
    step: {
      blocks: [TextField({ code: 'minValue' }), TextField({ code: 'maxValue' })],
      validWhen: [
        validation({
          condition: Answer('minValue').not.match(Condition.Equals(Answer('maxValue'))),
          message: 'Minimum and maximum must be different',
        }),
      ],
      validateOnEntry: [{ groups: ['default'], when: true }],
    },
    tests: [
      {
        name: 'should show domain validation errors on GET when validateOnEntry is set',
        session: { answers: { minValue: '10', maxValue: '10' } },
        showFailures: true,
        domainErrors: ['Minimum and maximum must be different'],
        errors: {},
      },
    ],
  },
  {
    description: 'conditional entry validation',
    step: {
      blocks: [requiredField('fullName', 'Enter your full name')],
      validateOnEntry: [{ groups: ['default'], when: Data('shouldValidate').match(Condition.Equals(true)) }],
    },
    tests: [
      {
        name: 'should skip entry validation when validateOnEntry when predicate is false',
        session: { data: { shouldValidate: false }, answers: { fullName: '' } },
        showFailures: false,
        errors: {},
      },
      {
        name: 'should run entry validation when validateOnEntry when predicate is true',
        session: { data: { shouldValidate: true }, answers: { fullName: '' } },
        showFailures: true,
        errors: { fullName: ['Enter your full name'] },
      },
    ],
  },
  {
    description: 'named-group entry validation',
    step: {
      blocks: [
        TextField({
          code: 'draftNote',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter a draft note',
            }),
          ],
        }),
        TextField({
          code: 'entryCode',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter an entry code',
              groups: ['entry-checks'],
            }),
          ],
        }),
      ],
      validateOnEntry: [{ groups: ['entry-checks'], when: true }],
    },
    tests: [
      {
        name: 'should run only the named group rules when validateOnEntry selects a non-default group',
        session: { answers: { draftNote: '', entryCode: '' } },
        showFailures: true,
        errors: { draftNote: [], entryCode: ['Enter an entry code'] },
      },
    ],
  },
  {
    description: 'multiple validateOnEntry entries',
    step: {
      blocks: [
        TextField({
          code: 'contactEmail',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter a contact email',
              groups: ['contact-checks'],
            }),
          ],
        }),
        TextField({
          code: 'passportNumber',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter a passport number',
              groups: ['identity-checks'],
            }),
          ],
        }),
      ],
      validateOnEntry: [
        { groups: ['contact-checks'], when: true },
        { groups: ['identity-checks'], when: Data('checkIdentity').match(Condition.Equals(true)) },
      ],
    },
    tests: [
      {
        name: 'should combine groups from every matching validateOnEntry entry into one validation run',
        session: { data: { checkIdentity: true }, answers: { contactEmail: '', passportNumber: '' } },
        showFailures: true,
        errors: { contactEmail: ['Enter a contact email'], passportNumber: ['Enter a passport number'] },
      },
      {
        name: 'should exclude groups from validateOnEntry entries whose when predicate is false',
        session: { data: { checkIdentity: false }, answers: { contactEmail: '', passportNumber: '' } },
        showFailures: true,
        errors: { contactEmail: ['Enter a contact email'], passportNumber: [] },
      },
    ],
  },
  {
    description: 'iterator validation',
    step: {
      blocks: [
        memberNameCollection([
          validation({ condition: Self().match(Condition.IsRequired()), message: 'Enter a name' }),
        ]),
      ],
    },
    tests: [
      {
        name: 'should validate each iterator field independently',
        post: { memberName_0: 'Alice', memberName_1: '' },
        session: twoMembers,
        errors: { memberName_0: [], memberName_1: ['Enter a name'] },
      },
      {
        name: 'should pass when all iterator fields are valid',
        post: { memberName_0: 'Alice', memberName_1: 'Bob' },
        session: twoMembers,
        valid: true,
      },
      {
        name: 'should pass validation when iterator collection is empty',
        post: {},
        session: { data: { members: [] } },
        valid: true,
      },
      {
        name: 'should fail validation when iterator collection is non-empty and fields are invalid',
        post: { memberName_0: '' },
        session: { data: { members: [{ name: 'Ada' }] } },
        showFailures: true,
        errors: { memberName_0: [{ message: 'Enter a name', passed: false }] },
      },
    ],
  },
  {
    description: 'iterator multiple failures',
    step: {
      blocks: [
        memberNameCollection([
          validation({ condition: Self().match(Condition.IsRequired()), message: 'Enter a name' }),
          validation({
            condition: Self().match(Condition.String.HasMinLength(2)),
            message: 'Name must be at least 2 characters',
          }),
        ]),
      ],
    },
    tests: [
      {
        name: 'should collect multiple failures per iterator field',
        post: { memberName_0: '', memberName_1: 'A' },
        session: twoMembers,
        errors: {
          memberName_0: ['Enter a name', 'Name must be at least 2 characters'],
          memberName_1: ['Name must be at least 2 characters'],
        },
      },
    ],
  },
  {
    description: 'iterator formatted values',
    step: {
      blocks: [
        CollectionBlock({
          collection: Data('members').each(
            Iterator.Map([
              TextField({
                code: Format('memberName_%1', Loop.Index0()),
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
      ],
    },
    tests: [
      {
        name: 'should validate the formatted value inside an iterator',
        post: { memberName_0: '  ab  ', memberName_1: '  Ada  ' },
        session: twoMembers,
        errors: { memberName_0: ['Name must be at least 3 characters'], memberName_1: [] },
      },
    ],
  },
  {
    description: 'nested iterator validation',
    step: {
      blocks: [
        CollectionBlock({
          collection: Data('teams').each(
            Iterator.Map([
              CollectionBlock({
                collection: Item()
                  .path('members')
                  .each(
                    Iterator.Map([
                      TextField({
                        code: Format('team_%1_member_%2', Loop.Parent.Index0(), Loop.Index0()),
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
      ],
    },
    tests: [
      {
        name: 'should validate fields in nested iterators independently',
        post: { team_0_member_0: 'Alice', team_0_member_1: '', team_1_member_0: '' },
        session: {
          data: {
            teams: [
              { name: 'Alpha', members: [{ name: 'Ada' }, { name: 'Grace' }] },
              { name: 'Beta', members: [{ name: 'Linus' }] },
            ],
          },
        },
        errors: {
          team_0_member_0: [],
          team_0_member_1: ['Enter a name'],
          team_1_member_0: ['Enter a name'],
        },
      },
    ],
  },
  {
    description: 'onInvalid branch',
    step: {
      blocks: [requiredField('fullName', 'Enter your full name')],
      onSubmission: [
        submit({
          validate: true,
          onValid: { next: [redirect({ goto: 'done' })] },
          onInvalid: { next: [redirect({ goto: 'invalid' })] },
        }),
      ],
    },
    tests: [
      {
        name: 'should follow onInvalid redirect when validation fails',
        post: { fullName: '' },
        redirectTo: '/scaffold/invalid',
      },
      {
        name: 'should follow onValid redirect when validation passes',
        post: { fullName: 'Ada' },
        redirectTo: '/scaffold/done',
      },
    ],
  },
  {
    description: 'and() combinator',
    step: {
      blocks: [
        TextField({
          code: 'username',
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
      ],
    },
    tests: [
      {
        name: 'should fail when and() combinator has any false condition',
        post: { username: 'ab' },
        errors: { username: ['Username must be 3-10 characters'] },
      },
      {
        name: 'should pass when and() combinator has all true conditions',
        post: { username: 'hello' },
        valid: true,
      },
    ],
  },
  {
    description: 'or() combinator',
    step: {
      blocks: [TextField({ code: 'email' }), TextField({ code: 'phone' })],
      validWhen: [
        validation({
          condition: or(Answer('email').match(Condition.IsRequired()), Answer('phone').match(Condition.IsRequired())),
          message: 'Enter either an email or phone number',
        }),
      ],
    },
    tests: [
      {
        name: 'should pass domain validation when or() combinator has any true condition',
        post: { email: 'ada@example.com', phone: '' },
        valid: true,
      },
      {
        name: 'should fail domain validation when or() combinator has all false conditions',
        post: { email: '', phone: '' },
        domainErrors: ['Enter either an email or phone number'],
      },
    ],
  },
  {
    description: 'not() combinator',
    step: {
      blocks: [
        TextField({
          code: 'keyword',
          validWhen: [
            validation({
              condition: not(Self().match(Condition.Equals('forbidden'))),
              message: 'Cannot use forbidden value',
            }),
          ],
        }),
      ],
    },
    tests: [
      {
        name: 'should fail when not() negates a true condition',
        post: { keyword: 'forbidden' },
        errors: { keyword: ['Cannot use forbidden value'] },
      },
      {
        name: 'should pass when not() negates a false condition',
        post: { keyword: 'allowed' },
        valid: true,
      },
    ],
  },
  {
    description: 'xor() combinator',
    step: {
      blocks: [TextField({ code: 'email' }), TextField({ code: 'phone' })],
      validWhen: [
        validation({
          condition: xor(Answer('email').match(Condition.IsRequired()), Answer('phone').match(Condition.IsRequired())),
          message: 'Enter either email or phone, but not both',
        }),
      ],
    },
    tests: [
      {
        name: 'should pass when xor() has exactly one true condition',
        post: { email: 'ada@example.com', phone: '' },
        valid: true,
      },
      {
        name: 'should fail when xor() has all true conditions',
        post: { email: 'ada@example.com', phone: '07700900000' },
        domainErrors: ['Enter either email or phone, but not both'],
      },
      {
        name: 'should fail when xor() has no true conditions',
        post: { email: '', phone: '' },
        domainErrors: ['Enter either email or phone, but not both'],
      },
    ],
  },
  {
    description: 'function argument scoping',
    step: {
      blocks: [
        TextField({
          code: 'generatorSubject',
          validWhen: [
            validation({
              condition: FixedText('yes').match(EqualsValue('yes')),
              message: 'Generator subject rule failed',
            }),
          ],
        }),
        TextField({
          code: 'twoArguments',
          validWhen: [
            validation({
              condition: FixedText('abcdef').match(LengthBetween(5, 9)),
              message: 'Two-argument rule failed',
            }),
          ],
        }),
        TextField({
          code: 'pipedGenerator',
          validWhen: [
            validation({
              condition: FixedText('ye').pipe(AppendSuffix('s')).match(EqualsValue('yes')),
              message: 'Piped generator rule failed',
            }),
          ],
        }),
        TextField({
          code: 'nestedGenerator',
          validWhen: [
            validation({
              condition: FixedText(FixedText('yes')).match(EqualsValue('yes')),
              message: 'Nested generator rule failed',
            }),
          ],
        }),
        TextField({
          code: 'argumentCall',
          validWhen: [
            validation({
              condition: Self().match(EqualsValue(FixedText('yes'))),
              message: 'Enter yes',
            }),
          ],
        }),
        TextField({
          code: 'combined',
          validWhen: [
            validation({
              condition: and(FixedText('yes').match(EqualsValue('yes')), Self().match(EqualsValue('yes'))),
              message: 'Enter yes here too',
            }),
          ],
        }),
      ],
    },
    tests: [
      {
        name: 'should redirect when every generator-subject rule evaluates true',
        post: { argumentCall: 'yes', combined: 'yes' },
        valid: true,
      },
      {
        name: 'should fail only the answer-dependent rules when their values are wrong',
        post: { argumentCall: 'no', combined: 'no' },
        errors: {
          generatorSubject: [],
          twoArguments: [],
          pipedGenerator: [],
          nestedGenerator: [],
          argumentCall: ['Enter yes'],
          combined: ['Enter yes here too'],
        },
      },
    ],
  },
  {
    description: 'visibleWhen and validation',
    step: {
      blocks: [
        TextField({
          code: 'hiddenField',
          visibleWhen: false,
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'This field is required',
            }),
          ],
        }),
      ],
    },
    tests: [
      {
        name: 'should still run validation for fields hidden by visibleWhen',
        post: { hiddenField: '' },
        showFailures: true,
        errors: { hiddenField: ['This field is required'] },
      },
    ],
  },
  {
    description: 'yielded validation rules',
    step: {
      blocks: [
        TextField({
          code: 'keyword',
          validWhen: Data('forbiddenWords').each(
            Iterator.Map(
              validation({
                condition: Self().not.match(Condition.Equals(Item().value())),
                message: Format('Cannot use %1', Item().value()),
              }),
            ),
          ),
        }),
      ],
    },
    tests: [
      {
        name: 'should fail a field rule yielded by an iterator when its item matches',
        post: { keyword: 'beta' },
        session: { data: { forbiddenWords: ['alpha', 'beta'] } },
        errors: { keyword: ['Cannot use beta'] },
      },
      {
        name: 'should pass field rules yielded by an iterator when no item matches',
        post: { keyword: 'gamma' },
        session: { data: { forbiddenWords: ['alpha', 'beta'] } },
        valid: true,
      },
    ],
  },
  {
    description: 'yielded step rules',
    step: {
      blocks: [TextField({ code: 'keyword' })],
      validWhen: Data('bannedValues').each(
        Iterator.Map(
          validation({
            condition: Answer('keyword').not.match(Condition.Equals(Item().path('value'))),
            message: Format('%1', Item().path('message')),
          }),
        ),
      ),
    },
    tests: [
      {
        name: 'should fail step rules yielded by an iterator as domain errors',
        post: { keyword: 'beta' },
        session: {
          data: {
            bannedValues: [
              { value: 'alpha', message: 'Alpha is banned' },
              { value: 'beta', message: 'Beta is banned' },
            ],
          },
        },
        domainErrors: ['Beta is banned'],
      },
    ],
  },
]
