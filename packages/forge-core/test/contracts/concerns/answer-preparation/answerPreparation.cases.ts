import { z } from 'zod'

import {
  validation,
  and,
  or,
  Answer,
  Condition,
  Data,
  Format,
  Item,
  Iterator,
  Loop,
  Self,
  Transformer,
} from '../../../../src/authoring'
import { CollectionBlock } from '../../../../src/components'
import type { StepContractCase } from '../../contractRunner'
import { ContractConditions, ContractGenerators, ContractTransformers } from '../../contractHelpers'
import { CheckboxField, DateField, TextField } from '../../testComponents'

function memberNameCollection(props: Partial<TextField> = {}) {
  return CollectionBlock({
    collection: Data('members').each(
      Iterator.Map([
        TextField({
          ...props,
          code: Format('memberName_%1', Loop.Index0()),
        }),
      ]),
    ),
  })
}

const twoMembers = { data: { members: [{ name: 'Ada' }, { name: 'Grace' }] } }

// Async counterparts of the preparation callbacks, compiled down the awaited
// paths: formatter/parser transformers, a defaultValue generator, and a
// dependentWhen condition.
const TrimAsync = ContractTransformers.register('Prep.TrimAsync', {
  inputSchema: z.string(),
  factory: () => async (value: string) => value.trim(),
})

const ToUpperAsync = ContractTransformers.register('Prep.ToUpperAsync', {
  inputSchema: z.string(),
  factory: () => async (value: string) => value.toUpperCase(),
})

const DefaultNameAsync = ContractGenerators.register('Prep.DefaultNameAsync', {
  factory: () => async () => 'generated-name',
})

const EqualsAsync = ContractConditions.register('Prep.EqualsAsync', {
  factory: () => async (value: unknown, expected: unknown) => value === expected,
})

export const cases: StepContractCase[] = [
  {
    description: 'value storage',
    step: { blocks: [TextField({ code: 'fullName' })] },
    tests: [
      {
        name: 'should store submitted field values',
        post: { fullName: 'Ada Lovelace' },
        saved: { fullName: 'Ada Lovelace' },
      },
      {
        name: 'should store empty string when submitted',
        post: { fullName: '' },
        saved: { fullName: '' },
      },
      {
        name: 'should drop an object submitted to a text field',
        post: { fullName: { unexpected: 'object' } },
        saved: {},
      },
      {
        name: 'should leave a schema-backed field unanswered when no value is submitted',
        post: {},
        saved: {},
      },
      {
        name: 'should pick first non-empty value when non-multiple field receives an array',
        post: { fullName: ['', 'selected'] },
        saved: { fullName: 'selected' },
      },
    ],
  },
  {
    description: 'formatters',
    step: {
      blocks: [
        TextField({
          code: 'fullName',
          formatters: [Transformer.String.Trim(), Transformer.String.ToTitleCase()],
        }),
      ],
    },
    tests: [
      {
        name: 'should run formatters on POST',
        post: { fullName: '  ada lovelace  ' },
        saved: { fullName: 'Ada Lovelace' },
      },
    ],
  },
  {
    description: 'formatting before validation',
    step: {
      blocks: [
        TextField({
          code: 'fullName',
          formatters: [Transformer.String.Trim()],
          validWhen: [
            validation({
              condition: Self().match(Condition.String.HasMaxLength(3)),
              message: 'Name must be 3 characters or fewer',
            }),
          ],
        }),
      ],
    },
    tests: [
      {
        name: 'should keep formatted value when validation fails after formatting',
        post: { fullName: '  hello  ' },
        showFailures: true,
        current: { fullName: 'hello' },
      },
    ],
  },
  {
    description: 'formatter TypeError handling',
    step: { blocks: [TextField({ code: 'age', formatters: [Transformer.String.ToInt()] })] },
    tests: [
      {
        name: 'should preserve original value when formatter throws TypeError',
        post: { age: 'not-a-number' },
        saved: { age: 'not-a-number' },
      },
    ],
  },
  {
    description: 'formatter chain TypeError handling',
    step: {
      blocks: [TextField({ code: 'amount', formatters: [Transformer.String.Trim(), Transformer.String.ToInt()] })],
    },
    tests: [
      {
        name: 'should revert to original value when a later formatter in the chain throws TypeError',
        post: { amount: '  not-a-number  ' },
        saved: { amount: '  not-a-number  ' },
      },
    ],
  },
  {
    description: 'async formatters',
    step: { blocks: [TextField({ code: 'fullName', formatters: [TrimAsync()] })] },
    tests: [
      {
        name: 'should await an async formatter on POST',
        post: { fullName: '  ada  ' },
        saved: { fullName: 'ada' },
      },
    ],
  },
  {
    description: 'parsers',
    step: { blocks: [TextField({ code: 'fullName', parsers: [Transformer.String.ToUpperCase()] })] },
    tests: [
      {
        name: 'should apply parsers on GET without changing stored answers',
        session: { answers: { fullName: 'ada lovelace' } },
        current: { fullName: 'ada lovelace' },
        parsed: { fullName: 'ADA LOVELACE' },
      },
    ],
  },
  {
    description: 'parser TypeError handling',
    step: { blocks: [TextField({ code: 'age', parsers: [Transformer.String.ToInt()] })] },
    tests: [
      {
        name: 'should fall back to original value when parser throws TypeError on GET',
        session: { answers: { age: 'not-a-number' } },
        current: { age: 'not-a-number' },
        parsed: { age: 'not-a-number' },
      },
    ],
  },
  {
    description: 'async parsers',
    step: { blocks: [TextField({ code: 'fullName', parsers: [ToUpperAsync()] })] },
    tests: [
      {
        name: 'should await an async parser on GET without changing stored answers',
        session: { answers: { fullName: 'ada lovelace' } },
        current: { fullName: 'ada lovelace' },
        parsed: { fullName: 'ADA LOVELACE' },
      },
    ],
  },
  {
    description: 'parsers over default values',
    step: {
      blocks: [
        TextField({
          code: 'fullName',
          defaultValue: 'ada lovelace',
          parsers: [Transformer.String.ToUpperCase()],
        }),
      ],
    },
    tests: [
      {
        name: 'should apply parser to defaultValue when no answer exists on GET',
        current: { fullName: 'ada lovelace' },
        parsed: { fullName: 'ADA LOVELACE' },
      },
    ],
  },
  {
    description: 'default values',
    step: { blocks: [TextField({ code: 'country', defaultValue: 'United Kingdom' })] },
    tests: [
      {
        name: 'should use defaultValue when no answer exists',
        current: { country: 'United Kingdom' },
      },
      {
        name: 'should not overwrite existing answer with defaultValue on GET',
        session: { answers: { country: 'France' } },
        current: { country: 'France' },
      },
      {
        name: 'should not seed defaultValue on POST',
        post: { country: '' },
        saved: { country: '' },
      },
    ],
  },
  {
    description: 'async default values',
    step: { blocks: [TextField({ code: 'fullName', defaultValue: DefaultNameAsync() })] },
    tests: [
      {
        name: 'should await an async defaultValue generator when no answer exists on GET',
        current: { fullName: 'generated-name' },
      },
    ],
  },
  {
    description: 'dependentWhen cleardown',
    step: {
      blocks: [
        TextField({ code: 'contactMethod' }),
        TextField({
          code: 'emailAddress',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
        }),
      ],
    },
    tests: [
      {
        name: 'should clear dependent field answers when dependentWhen is false',
        post: { contactMethod: 'phone', emailAddress: 'ada@example.com' },
        session: { answers: { contactMethod: 'email', emailAddress: 'ada@example.com' } },
        saved: { contactMethod: 'phone' },
      },
      {
        name: 'should retain dependent field answers when dependentWhen is true',
        post: { contactMethod: 'email', emailAddress: 'ada@example.com' },
        saved: { contactMethod: 'email', emailAddress: 'ada@example.com' },
      },
      {
        name: 'should not evaluate dependentWhen on GET',
        session: { answers: { contactMethod: 'phone', emailAddress: 'preserved@example.com' } },
        current: { emailAddress: 'preserved@example.com' },
      },
    ],
  },
  {
    description: 'async dependentWhen cleardown',
    step: {
      blocks: [
        TextField({ code: 'contactMethod' }),
        TextField({
          code: 'emailAddress',
          dependentWhen: Answer('contactMethod').match(EqualsAsync('email')),
        }),
      ],
    },
    tests: [
      {
        name: 'should clear dependent field answers when an awaited dependentWhen is false',
        post: { contactMethod: 'phone', emailAddress: 'ada@example.com' },
        session: { answers: { contactMethod: 'email', emailAddress: 'ada@example.com' } },
        saved: { contactMethod: 'phone' },
      },
      {
        name: 'should retain dependent field answers when an awaited dependentWhen is true',
        post: { contactMethod: 'email', emailAddress: 'ada@example.com' },
        saved: { contactMethod: 'email', emailAddress: 'ada@example.com' },
      },
    ],
  },
  {
    description: 'visibleWhen answer preservation',
    step: {
      blocks: [
        TextField({ code: 'toggle' }),
        TextField({
          code: 'detail',
          visibleWhen: Answer('toggle').match(Condition.Equals('yes')),
        }),
      ],
    },
    tests: [
      {
        name: 'should not clear answers for fields hidden by visibleWhen',
        post: { toggle: 'no', detail: 'some detail' },
        session: { answers: { toggle: 'yes', detail: 'some detail' } },
        saved: { toggle: 'no', detail: 'some detail' },
      },
    ],
  },
  {
    description: 'divergent visibleWhen and dependentWhen',
    step: {
      blocks: [
        TextField({ code: 'showField' }),
        TextField({ code: 'activateField' }),
        TextField({
          code: 'conditionalField',
          visibleWhen: Answer('showField').match(Condition.Equals('yes')),
          dependentWhen: Answer('activateField').match(Condition.Equals('yes')),
        }),
      ],
    },
    tests: [
      {
        name: 'should clear answer when visibleWhen is true but dependentWhen is false',
        post: { showField: 'yes', activateField: 'no', conditionalField: 'some value' },
        session: { answers: { showField: 'yes', activateField: 'yes', conditionalField: 'some value' } },
        saved: { showField: 'yes', activateField: 'no' },
      },
      {
        name: 'should retain answer when visibleWhen is false but dependentWhen is true',
        post: { showField: 'no', activateField: 'yes', conditionalField: 'some value' },
        saved: { showField: 'no', activateField: 'yes', conditionalField: 'some value' },
      },
    ],
  },
  {
    description: 'combined visibleWhen and dependentWhen',
    step: {
      blocks: [
        TextField({ code: 'contactMethod' }),
        TextField({
          code: 'emailAddress',
          visibleWhen: Answer('contactMethod').match(Condition.Equals('email')),
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
        name: 'should clear answer and skip validation when both conditions are false',
        post: { contactMethod: 'phone' },
        session: { answers: { contactMethod: 'email', emailAddress: 'ada@example.com' } },
        valid: true,
        saved: { contactMethod: 'phone' },
      },
    ],
  },
  {
    description: 'multiple dependentWhen fields',
    step: {
      blocks: [
        TextField({ code: 'contactMethod' }),
        TextField({
          code: 'emailAddress',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
        }),
        TextField({
          code: 'phoneNumber',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('phone')),
        }),
        TextField({
          code: 'postalAddress',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('post')),
        }),
      ],
    },
    tests: [
      {
        name: 'should clear inactive dependent fields and retain the active one',
        post: {
          contactMethod: 'email',
          emailAddress: 'ada@example.com',
          phoneNumber: '07700900000',
          postalAddress: '123 Street',
        },
        session: {
          answers: {
            contactMethod: 'phone',
            emailAddress: 'old@example.com',
            phoneNumber: '07700900000',
            postalAddress: '123 Street',
          },
        },
        saved: { contactMethod: 'email', emailAddress: 'ada@example.com' },
      },
      {
        name: 'should evaluate each dependent field independently when the active method changes',
        post: {
          contactMethod: 'post',
          emailAddress: 'ada@example.com',
          phoneNumber: '07700900000',
          postalAddress: '123 Street',
        },
        saved: { contactMethod: 'post', postalAddress: '123 Street' },
      },
    ],
  },
  {
    description: 'and() dependentWhen predicate',
    step: {
      blocks: [
        TextField({ code: 'hasEmail' }),
        TextField({ code: 'wantsNotifications' }),
        TextField({
          code: 'notificationEmail',
          dependentWhen: and(
            Answer('hasEmail').match(Condition.Equals('yes')),
            Answer('wantsNotifications').match(Condition.Equals('yes')),
          ),
        }),
      ],
    },
    tests: [
      {
        name: 'should retain answer when all and() conditions are true',
        post: { hasEmail: 'yes', wantsNotifications: 'yes', notificationEmail: 'notify@example.com' },
        saved: { hasEmail: 'yes', wantsNotifications: 'yes', notificationEmail: 'notify@example.com' },
      },
      {
        name: 'should clear answer when any and() condition is false',
        post: { hasEmail: 'yes', wantsNotifications: 'no', notificationEmail: 'notify@example.com' },
        session: {
          answers: { hasEmail: 'yes', wantsNotifications: 'yes', notificationEmail: 'notify@example.com' },
        },
        saved: { hasEmail: 'yes', wantsNotifications: 'no' },
      },
    ],
  },
  {
    description: 'or() dependentWhen predicate',
    step: {
      blocks: [
        TextField({ code: 'role' }),
        TextField({
          code: 'accessCode',
          dependentWhen: or(
            Answer('role').match(Condition.Equals('admin')),
            Answer('role').match(Condition.Equals('manager')),
          ),
        }),
      ],
    },
    tests: [
      {
        name: 'should retain answer when any or() condition is true',
        post: { role: 'manager', accessCode: 'ABC123' },
        saved: { role: 'manager', accessCode: 'ABC123' },
      },
      {
        name: 'should clear answer when all or() conditions are false',
        post: { role: 'viewer', accessCode: 'ABC123' },
        session: { answers: { role: 'admin', accessCode: 'ABC123' } },
        saved: { role: 'viewer' },
      },
    ],
  },
  {
    description: 'formatter then dependentWhen ordering',
    step: {
      blocks: [
        TextField({ code: 'includeNotes' }),
        TextField({
          code: 'notes',
          formatters: [Transformer.String.Trim()],
          dependentWhen: Answer('includeNotes').match(Condition.Equals('yes')),
        }),
      ],
    },
    tests: [
      {
        name: 'should discard formatted value when dependentWhen is false',
        post: { includeNotes: 'no', notes: '  trimmed value  ' },
        session: { answers: { includeNotes: 'yes', notes: 'existing note' } },
        saved: { includeNotes: 'no' },
      },
      {
        name: 'should apply formatter then retain value when dependentWhen is true',
        post: { includeNotes: 'yes', notes: '  trimmed value  ' },
        saved: { includeNotes: 'yes', notes: 'trimmed value' },
      },
    ],
  },
  {
    description: 'same-code field variants',
    step: {
      blocks: [
        TextField({ code: 'employment_status' }),
        TextField({
          code: 'has_been_employed',
          dependentWhen: Answer('employment_status').match(Condition.Equals('unavailable')),
        }),
        TextField({
          code: 'has_been_employed',
          dependentWhen: Answer('employment_status').match(Condition.Equals('actively-seeking')),
        }),
        TextField({
          code: 'has_been_employed',
          dependentWhen: Answer('employment_status').match(Condition.Equals('not-actively-seeking')),
        }),
      ],
    },
    tests: [
      {
        name: 'should keep the submitted value when the active same-code copy is the first declared',
        post: { employment_status: 'unavailable', has_been_employed: 'yes' },
        saved: { employment_status: 'unavailable', has_been_employed: 'yes' },
      },
    ],
  },
  {
    description: 'iterator field codes',
    step: { blocks: [memberNameCollection()] },
    tests: [
      {
        name: 'should resolve dynamic field codes per item in an iterator',
        post: { memberName_0: 'Alice', memberName_1: 'Bob' },
        session: twoMembers,
        saved: { memberName_0: 'Alice', memberName_1: 'Bob' },
      },
    ],
  },
  {
    description: 'iterator formatters',
    step: {
      blocks: [memberNameCollection({ formatters: [Transformer.String.Trim(), Transformer.String.ToTitleCase()] })],
    },
    tests: [
      {
        name: 'should run formatters per item in an iterator',
        post: { memberName_0: '  alice  ', memberName_1: '  bob  ' },
        session: twoMembers,
        saved: { memberName_0: 'Alice', memberName_1: 'Bob' },
      },
    ],
  },
  {
    description: 'iterator default values',
    step: { blocks: [memberNameCollection({ defaultValue: Item().path('name') })] },
    tests: [
      {
        name: 'should seed defaultValue per item in an iterator on GET',
        session: twoMembers,
        current: { memberName_0: 'Ada', memberName_1: 'Grace' },
      },
    ],
  },
  {
    description: 'nested iterators',
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
        name: 'should resolve multi-level field codes in nested iterators',
        post: { team_0_member_0: 'Ada', team_0_member_1: 'Grace', team_1_member_0: 'Linus' },
        session: {
          data: {
            teams: [
              { name: 'Alpha', members: [{ name: 'Ada' }, { name: 'Grace' }] },
              { name: 'Beta', members: [{ name: 'Linus' }] },
            ],
          },
        },
        saved: { team_0_member_0: 'Ada', team_0_member_1: 'Grace', team_1_member_0: 'Linus' },
      },
    ],
  },
  {
    description: 'iterator dependentWhen',
    step: {
      blocks: [
        TextField({ code: 'showDetails' }),
        memberNameCollection({ dependentWhen: Answer('showDetails').match(Condition.Equals('yes')) }),
      ],
    },
    tests: [
      {
        name: 'should preserve iterator field answers when dependentWhen is true',
        post: { showDetails: 'yes', memberName_0: 'Alice', memberName_1: 'Bob' },
        session: twoMembers,
        saved: { showDetails: 'yes', memberName_0: 'Alice', memberName_1: 'Bob' },
      },
      {
        name: 'should clear iterator field answers when dependentWhen is false',
        post: { showDetails: 'no', memberName_0: 'Alice', memberName_1: 'Bob' },
        session: twoMembers,
        saved: { showDetails: 'no' },
      },
    ],
  },
  {
    description: 'multiple-value fields',
    step: { blocks: [CheckboxField({ code: 'colors' })] },
    tests: [
      {
        name: 'should normalize single checkbox value to array',
        post: { colors: 'red' },
        saved: { colors: ['red'] },
      },
      {
        name: 'should store empty array when multiple checkbox field is absent from POST body',
        post: {},
        saved: { colors: [] },
      },
      {
        name: 'should pass checkbox array values through unchanged',
        post: { colors: ['red', 'blue'] },
        saved: { colors: ['red', 'blue'] },
      },
    ],
  },
  {
    description: 'object-schema fields',
    step: { blocks: [DateField({ code: 'dob' })] },
    tests: [
      {
        name: 'should accept a date-parts object submitted to a date input field',
        post: { dob: { day: '31', month: '3', year: '1980' } },
        saved: { dob: '1980-03-31' },
      },
      {
        name: 'should drop a string submitted to a date input field',
        post: { dob: 'not-a-date' },
        saved: {},
      },
    ],
  },
]
