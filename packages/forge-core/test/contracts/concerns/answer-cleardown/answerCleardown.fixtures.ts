import {
  journey,
  step,
  access,
  submit,
  redirect,
  validation,
  Answer,
  Data,
  Condition,
  Format,
  Item,
  Iterator,
  Loop,
  Self,
} from '../../../../src/authoring'
import { CollectionBlock } from '../../../../src/components'
import { Effects } from '../../contractHelpers'
import { TextField, StaticText, RadioField } from '../../testComponents'

export const unreachableStepCleardownJourney = journey({
  code: 'cleardown',
  path: '/cleardown',
  title: 'Unreachable step cleardown',
  onAccess: [access({ effects: [Effects.LoadAnswers('cleardown')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      reachability: { entryWhen: true },
      blocks: [
        RadioField({
          code: 'route',
          items: [
            { value: 'detail', text: 'Detail' },
            { value: 'skip', text: 'Skip' },
          ],
        }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('cleardown')],
            next: [
              redirect({ when: Answer('route').match(Condition.Equals('detail')), goto: 'detail' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({
      path: '/detail',
      title: 'Detail',
      blocks: [TextField({ code: 'detail' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('cleardown')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const linearChainCleardownJourney = journey({
  code: 'chain',
  path: '/chain',
  title: 'Linear chain cleardown',
  onAccess: [access({ effects: [Effects.LoadAnswers('chain')] })],
  steps: [
    step({
      code: 'a',
      path: '/a',
      title: 'A',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'fieldA',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'b' })] } })],
    }),
    step({
      code: 'b',
      path: '/b',
      title: 'B',
      blocks: [
        TextField({
          code: 'fieldB',
          validWhen: [validation({ condition: Self().match(Condition.Equals('valid-b')), message: 'Must be valid-b' })],
        }),
      ],
      onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'c' })] } })],
    }),
    step({
      code: 'c',
      path: '/c',
      title: 'C',
      blocks: [
        TextField({
          code: 'fieldC',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
    }),
  ],
})

export const cleardownMutationTrailJourney = journey({
  code: 'cleardown-trail',
  path: '/cleardown-trail',
  title: 'Cleardown mutation trail',
  onAccess: [access({ effects: [Effects.LoadAnswers('cleardown-trail')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      reachability: { entryWhen: true },
      blocks: [
        RadioField({
          code: 'route',
          items: [
            { value: 'detail', text: 'Detail' },
            { value: 'skip', text: 'Skip' },
          ],
        }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('cleardown-trail')],
            next: [
              redirect({ when: Answer('route').match(Condition.Equals('detail')), goto: 'detail' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({
      path: '/detail',
      title: 'Detail',
      blocks: [TextField({ code: 'detail' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('cleardown-trail')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const cleardownOnGetJourney = journey({
  code: 'cleardown-get',
  path: '/cleardown-get',
  title: 'Cleardown on GET',
  onAccess: [access({ effects: [Effects.LoadAnswers('cleardown-get')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      reachability: { entryWhen: true },
      blocks: [
        RadioField({
          code: 'route',
          items: [
            { value: 'detail', text: 'Detail' },
            { value: 'skip', text: 'Skip' },
          ],
        }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('cleardown-get')],
            next: [
              redirect({ when: Answer('route').match(Condition.Equals('detail')), goto: 'detail' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({
      path: '/detail',
      title: 'Detail',
      blocks: [TextField({ code: 'detail' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('cleardown-get')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const iteratorCleardownJourney = journey({
  code: 'iter-cleardown',
  path: '/iter-cleardown',
  title: 'Iterator cleardown',
  onAccess: [access({ effects: [Effects.LoadAnswers('iter-cleardown')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      reachability: { entryWhen: true },
      blocks: [
        RadioField({
          code: 'route',
          items: [
            { value: 'members', text: 'Members' },
            { value: 'skip', text: 'Skip' },
          ],
        }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('iter-cleardown')],
            next: [
              redirect({ when: Answer('route').match(Condition.Equals('members')), goto: 'members' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({
      code: 'members',
      path: '/members',
      title: 'Members',
      cleardownFieldCodes: ['^memberName_\\d+$'],
      blocks: [TextField({ code: 'memberName_0' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('iter-cleardown')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

/** The detail step's field code is a generator-backed expression, so cleardown must evaluate the inventory at runtime. */
export const dynamicCodeCleardownJourney = journey({
  code: 'dynamic-cleardown',
  path: '/dynamic-cleardown',
  title: 'Dynamic code cleardown',
  onAccess: [access({ effects: [Effects.LoadData(), Effects.LoadAnswers('dynamic-cleardown')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      reachability: { entryWhen: true },
      blocks: [
        RadioField({
          code: 'route',
          items: [
            { value: 'detail', text: 'Detail' },
            { value: 'skip', text: 'Skip' },
          ],
        }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('dynamic-cleardown')],
            next: [
              redirect({ when: Answer('route').match(Condition.Equals('detail')), goto: 'detail' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({
      code: 'detail',
      path: '/detail',
      title: 'Detail',
      blocks: [TextField({ code: Format('detail_%1', Data('variant')) })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('dynamic-cleardown')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

/** The members step's fields come from a MAP iterator template, so the inventory must expand them per item. */
export const iteratorInventoryCleardownJourney = journey({
  code: 'iter-inventory',
  path: '/iter-inventory',
  title: 'Iterator inventory cleardown',
  onAccess: [access({ effects: [Effects.LoadData(), Effects.LoadAnswers('iter-inventory')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      reachability: { entryWhen: true },
      blocks: [
        RadioField({
          code: 'route',
          items: [
            { value: 'members', text: 'Members' },
            { value: 'skip', text: 'Skip' },
          ],
        }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('iter-inventory')],
            next: [
              redirect({ when: Answer('route').match(Condition.Equals('members')), goto: 'members' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({
      code: 'members',
      path: '/members',
      title: 'Members',
      blocks: [
        CollectionBlock({
          collection: Data('members').each(Iterator.Map([TextField({ code: Format('memberName_%1', Loop.Index0()) })])),
        }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('iter-inventory')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

/** The members step's fields come from nested MAP iterators, so the inventory must resolve both loop scopes. */
export const nestedIteratorInventoryCleardownJourney = journey({
  code: 'nested-inventory',
  path: '/nested-inventory',
  title: 'Nested iterator inventory cleardown',
  onAccess: [access({ effects: [Effects.LoadData(), Effects.LoadAnswers('nested-inventory')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      reachability: { entryWhen: true },
      blocks: [
        RadioField({
          code: 'route',
          items: [
            { value: 'members', text: 'Members' },
            { value: 'skip', text: 'Skip' },
          ],
        }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('nested-inventory')],
            next: [
              redirect({ when: Answer('route').match(Condition.Equals('members')), goto: 'members' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({
      code: 'members',
      path: '/members',
      title: 'Members',
      blocks: [
        CollectionBlock({
          collection: Data('teams').each(
            Iterator.Map([
              CollectionBlock({
                collection: Item()
                  .path('members')
                  .each(
                    Iterator.Map([
                      TextField({ code: Format('team_%1_member_%2', Loop.Parent.Index0(), Loop.Index0()) }),
                    ]),
                  ),
              }),
            ]),
          ),
        }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('nested-inventory')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

/** Disabled reachability checks force every step reachable, so the unreachable set feeding cleardown is always empty. */
export const disabledReachabilityCleardownJourney = journey({
  code: 'disabled-cleardown',
  path: '/disabled-cleardown',
  title: 'Disabled reachability cleardown',
  reachability: { disableReachabilityChecks: true },
  onAccess: [access({ effects: [Effects.LoadAnswers('disabled-cleardown')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      reachability: { entryWhen: true },
      blocks: [
        RadioField({
          code: 'route',
          items: [
            { value: 'detail', text: 'Detail' },
            { value: 'skip', text: 'Skip' },
          ],
        }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('disabled-cleardown')],
            next: [
              redirect({ when: Answer('route').match(Condition.Equals('detail')), goto: 'detail' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({
      path: '/detail',
      title: 'Detail',
      blocks: [TextField({ code: 'detail' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('disabled-cleardown')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const conditionalEntryCleardownJourney = journey({
  code: 'cond-entry-clear',
  path: '/cond-entry-clear',
  title: 'Conditional entry cleardown',
  onAccess: [access({ effects: [Effects.LoadData(), Effects.LoadAnswers('cond-entry-clear')] })],
  steps: [
    step({
      path: '/main',
      title: 'Main',
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: 'Main step' })],
    }),
    step({
      path: '/bonus',
      title: 'Bonus',
      reachability: { entryWhen: Data('bonusEnabled').match(Condition.Equals(true)) },
      blocks: [TextField({ code: 'bonusDetail' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('cond-entry-clear')],
            next: [redirect({ goto: 'bonus-done' })],
          },
        }),
      ],
    }),
    step({
      code: 'bonus-done',
      path: '/bonus-done',
      title: 'Bonus Done',
      blocks: [StaticText({ text: 'Bonus complete' })],
    }),
  ],
})

export const parameterizedCleardownJourney = journey({
  code: 'param-cleardown',
  path: '/param-cleardown/:id',
  title: 'Parameterized Cleardown',
  onAccess: [access({ effects: [Effects.LoadAnswers('param-cleardown')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      reachability: { entryWhen: true },
      blocks: [
        RadioField({
          code: 'route',
          items: [
            { value: 'detail', text: 'Detail' },
            { value: 'skip', text: 'Skip' },
          ],
        }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('param-cleardown')],
            next: [
              redirect({ when: Answer('route').match(Condition.Equals('detail')), goto: 'detail' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({
      path: '/detail',
      title: 'Detail',
      blocks: [TextField({ code: 'detail' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('param-cleardown')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})
