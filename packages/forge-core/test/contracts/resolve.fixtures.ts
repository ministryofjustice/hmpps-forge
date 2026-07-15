import {
  GovUKTextInput,
  GovUKButton,
  GovUKRadioInput,
  GovUKInsetText,
} from '@ministryofjustice/hmpps-forge/govuk-components'

import {
  journey,
  step,
  access,
  submit,
  redirect,
  validation,
  Transformer,
  Answer,
  Data,
  Format,
  Iterator,
  Loop,
  Self,
  Condition,
} from '../../src/authoring'
import { CollectionBlock } from '../../src/components'
import { Effects } from './contractHelpers'

export const basicBlocksJourney = journey({
  code: 'basic-blocks',
  path: '/basic-blocks',
  title: 'Basic Blocks',
  onAccess: [access({ effects: [Effects.LoadAnswers('basic-blocks')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form Step',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'fullName', label: 'Full name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('basic-blocks')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const blockOrderingJourney = journey({
  code: 'ordering',
  path: '/ordering',
  title: 'Block Ordering',
  onAccess: [access({ effects: [Effects.LoadAnswers('ordering')] })],
  steps: [
    step({
      path: '/form',
      title: 'Ordered Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({ code: 'firstName', label: 'First name' }),
        GovUKTextInput({ code: 'lastName', label: 'Last name' }),
        GovUKTextInput({ code: 'email', label: 'Email address' }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('ordering')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const visibleWhenFalseJourney = journey({
  code: 'visible-false',
  path: '/visible-false',
  title: 'Visible When False',
  onAccess: [access({ effects: [Effects.LoadAnswers('visible-false')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({ code: 'shown', label: 'Shown field' }),
        GovUKTextInput({ code: 'hidden', label: 'Hidden field', visibleWhen: false }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('visible-false')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const visibleWhenDynamicJourney = journey({
  code: 'visible-dynamic',
  path: '/visible-dynamic',
  title: 'Visible When Dynamic',
  onAccess: [access({ effects: [Effects.LoadAnswers('visible-dynamic')] })],
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
          visibleWhen: Answer('contactMethod').match(Condition.Equals('email')),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('visible-dynamic')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const visibleWhenPreservesAnswerJourney = journey({
  code: 'visible-preserves',
  path: '/visible-preserves',
  title: 'Visible Preserves Answer',
  onAccess: [access({ effects: [Effects.LoadAnswers('visible-preserves')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'toggle',
          fieldset: { legend: { text: 'Show details?' } },
          items: [
            { value: 'yes', text: 'Yes' },
            { value: 'no', text: 'No' },
          ],
        }),
        GovUKTextInput({
          code: 'detail',
          label: 'Detail',
          visibleWhen: Answer('toggle').match(Condition.Equals('yes')),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('visible-preserves')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const dynamicPropertyJourney = journey({
  code: 'dynamic-prop',
  path: '/dynamic-prop',
  title: 'Dynamic Properties',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/info',
      title: 'Info',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: Data('message') }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const stepMetadataJourney = journey({
  code: 'step-meta',
  path: '/step-meta',
  title: 'Step Metadata',
  metadata: { journeyTag: 'test-journey' },
  steps: [
    step({
      path: '/form',
      title: 'Step Title',
      metadata: { section: 'personal-details' },
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'fullName', label: 'Full name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const answerDisplayJourney = journey({
  code: 'answer-display',
  path: '/answer-display',
  title: 'Answer Display',
  onAccess: [access({ effects: [Effects.LoadAnswers('answer-display')] })],
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
            effects: [Effects.SaveAnswers('answer-display')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const validationDisplayJourney = journey({
  code: 'validation-display',
  path: '/validation-display',
  title: 'Validation Display',
  onAccess: [access({ effects: [Effects.LoadAnswers('validation-display')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
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
        GovUKTextInput({
          code: 'email',
          label: 'Email',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your email',
            }),
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            effects: [Effects.SaveAnswers('validation-display')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const iteratorRenderJourney = journey({
  code: 'iter-render',
  path: '/iter-render',
  title: 'Iterator Render',
  onAccess: [access({ effects: [Effects.LoadData(), Effects.LoadAnswers('iter-render')] })],
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
                label: Format('Member %1 name', Loop.Index()),
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
            effects: [Effects.SaveAnswers('iter-render')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const dataDisplayJourney = journey({
  code: 'data-display',
  path: '/data-display',
  title: 'Data Display',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/info',
      title: 'Info',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Some info' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const domainValidationRenderJourney = journey({
  code: 'domain-render',
  path: '/domain-render',
  title: 'Domain Validation Render',
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
          onValid: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const backlinkJourney = journey({
  code: 'backlink',
  path: '/backlink',
  title: 'Backlink',
  steps: [
    step({
      path: '/step-one',
      title: 'Step One',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'fullName', label: 'Full name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'step-two' })] },
        }),
      ],
    }),
    step({
      code: 'step-two',
      path: '/step-two',
      title: 'Step Two',
      backlink: '/backlink/step-one',
      blocks: [GovUKTextInput({ code: 'email', label: 'Email' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const ancestorJourney = journey({
  code: 'parent',
  path: '/parent',
  title: 'Parent Journey',
  metadata: { section: 'top-level' },
  children: [
    journey({
      code: 'child',
      path: '/child',
      title: 'Child Journey',
      steps: [
        step({
          path: '/form',
          title: 'Child Form',
          reachability: { entryWhen: true },
          blocks: [GovUKTextInput({ code: 'fullName', label: 'Full name' }), GovUKButton({ text: 'Continue' })],
          onSubmission: [
            submit({
              validate: false,
              onAlways: { next: [redirect({ goto: 'done' })] },
            }),
          ],
        }),
        step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
      ],
    }),
  ],
})

export const autoDerivedBacklinkJourney = journey({
  code: 'auto-backlink',
  path: '/auto-backlink',
  title: 'Auto Derived Backlink',
  onAccess: [access({ effects: [Effects.LoadAnswers('auto-backlink')] })],
  steps: [
    step({
      path: '/step-one',
      title: 'Step One',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'firstName',
          label: 'First name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            effects: [Effects.SaveAnswers('auto-backlink')],
            next: [redirect({ goto: 'step-two' })],
          },
        }),
      ],
    }),
    step({
      code: 'step-two',
      path: '/step-two',
      title: 'Step Two',
      blocks: [GovUKTextInput({ code: 'lastName', label: 'Last name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('auto-backlink')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const stepViewJourney = journey({
  code: 'step-view',
  path: '/step-view',
  title: 'Step View',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      view: { template: 'custom-layout.njk', locals: { sidebar: 'enabled' } },
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'fullName', label: 'Full name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const inheritedViewJourney = journey({
  code: 'inherited-view',
  path: '/inherited-view',
  title: 'Inherited View',
  data: { resolvedLabel: 'resolved' },
  view: {
    template: 'root-layout',
    locals: { rootOnly: 'root', shared: 'root' },
  },
  children: [
    journey({
      code: 'inherited-view-child',
      path: '/child',
      title: 'Inherited View Child',
      view: {
        template: 'child-layout',
        locals: { childOnly: 'child', shared: 'child' },
      },
      steps: [
        step({
          path: '/step-view',
          title: 'Step View',
          view: {
            template: 'step-layout',
            locals: { stepOnly: 'step', shared: 'step', resolvedLabel: Data('resolvedLabel') },
          },
          reachability: { entryWhen: true },
        }),
        step({
          path: '/ancestor-view',
          title: 'Ancestor View',
          reachability: { entryWhen: true },
        }),
      ],
    }),
  ],
})

export const blockSkipPropsJourney = journey({
  code: 'block-skip',
  path: '/block-skip',
  title: 'Block Skip Props',
  onAccess: [access({ effects: [Effects.LoadAnswers('block-skip')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'trimmedField',
          label: 'Trimmed field',
          formatters: [Transformer.String.Trim()],
          parsers: [Transformer.String.Trim()],
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter a value',
            }),
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('block-skip')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const routeTreeJourney = journey({
  code: 'route-tree',
  path: '/route-tree',
  title: 'Route Tree',
  steps: [
    step({
      path: '/step-one',
      title: 'Step One',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'firstName', label: 'First name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'step-two' })] },
        }),
      ],
    }),
    step({
      code: 'step-two',
      path: '/step-two',
      title: 'Step Two',
      blocks: [GovUKTextInput({ code: 'lastName', label: 'Last name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const parsedValueRenderJourney = journey({
  code: 'parsed-render',
  path: '/parsed-render',
  title: 'Parsed Value Render',
  onAccess: [access({ effects: [Effects.LoadAnswers('parsed-render')] })],
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
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('parsed-render')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const postBlockValueAfterDependentWhenJourney = journey({
  code: 'post-block-dw',
  path: '/post-block-dw',
  title: 'POST Block Value After DependentWhen',
  onAccess: [access({ effects: [Effects.LoadAnswers('post-block-dw')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
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
            effects: [Effects.SaveAnswers('post-block-dw')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const transformerOverUnansweredJourney = journey({
  code: 'transformer-unanswered',
  path: '/transformer-unanswered',
  title: 'Transformer Over Unanswered',
  steps: [
    step({
      path: '/info',
      title: 'Info',
      reachability: { entryWhen: true },
      blocks: [
        GovUKInsetText({ text: Answer('missingField').pipe(Transformer.String.ToUpperCase()) }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const nestedBlockValidationJourney = journey({
  code: 'nested-valid',
  path: '/nested-valid',
  title: 'Nested Block Validation',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'choice',
          fieldset: { legend: { text: 'Choose' } },
          items: [
            {
              value: 'yes',
              text: 'Yes',
              block: GovUKTextInput({
                code: 'detail',
                label: 'Detail',
                validWhen: [
                  validation({
                    condition: Self().match(Condition.IsRequired()),
                    message: 'Enter a detail',
                  }),
                ],
              }),
            },
            { value: 'no', text: 'No' },
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})
