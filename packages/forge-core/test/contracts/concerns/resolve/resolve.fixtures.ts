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
  Item,
  Loop,
  Self,
  Condition,
  match,
  and,
  or,
  not,
} from '../../../../src/authoring'
import { CollectionBlock } from '../../../../src/components'
import { Effects } from '../../contractHelpers'
import { TextField, StaticText, RadioField } from '../../testComponents'

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
      blocks: [TextField({ code: 'fullName', label: 'Full name' }), StaticText({ text: 'Continue' })],
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
      blocks: [TextField({ code: 'firstName' }), TextField({ code: 'lastName' }), TextField({ code: 'email' })],
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
      blocks: [TextField({ code: 'shown' }), TextField({ code: 'hidden', visibleWhen: false })],
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
        RadioField({
          code: 'contactMethod',
          items: [
            { value: 'email', text: 'Email' },
            { value: 'phone', text: 'Phone' },
          ],
        }),
        TextField({
          code: 'emailAddress',
          visibleWhen: Answer('contactMethod').match(Condition.Equals('email')),
        }),
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
        RadioField({
          code: 'toggle',
          items: [
            { value: 'yes', text: 'Yes' },
            { value: 'no', text: 'No' },
          ],
        }),
        TextField({
          code: 'detail',
          visibleWhen: Answer('toggle').match(Condition.Equals('yes')),
        }),
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

export const visibleWhenNonFieldBlockJourney = journey({
  code: 'visible-nonfield',
  path: '/visible-nonfield',
  title: 'VisibleWhen on Non-Field Block',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/info',
      title: 'Info',
      reachability: { entryWhen: true },
      blocks: [
        StaticText({
          text: 'Conditional message',
          visibleWhen: Data('showMessage').match(Condition.Equals(true)),
        }),
        TextField({ code: 'name' }),
      ],
    }),
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
      blocks: [StaticText({ text: Data('message') })],
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
      blocks: [TextField({ code: 'fullName' })],
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
      blocks: [TextField({ code: 'fullName' })],
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

export const matchCombinatorJourney = journey({
  code: 'match-combinator',
  path: '/match-combinator',
  title: 'Match Combinator',
  onAccess: [access({ effects: [Effects.LoadAnswers('match-combinator')] })],
  steps: [
    step({
      path: '/reference',
      title: 'Reference',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'referenceCode' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('match-combinator')],
            next: [redirect({ goto: 'summary' })],
          },
        }),
      ],
    }),
    step({
      code: 'summary',
      path: '/summary',
      title: 'Summary',
      blocks: [
        StaticText({
          text: match(Answer('referenceCode'))
            .branch(
              or(
                and(Condition.String.StartsWith('FT'), not(Condition.String.Contains('-'))),
                Condition.Equals('LEGACY'),
              ),
              'Fast track referral',
            )
            .branch(Condition.String.HasMinLength(6), 'Standard referral')
            .otherwise('Unrecognised referral'),
        }),
      ],
    }),
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
        TextField({
          code: 'fullName',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your full name',
            }),
          ],
        }),
        TextField({
          code: 'email',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your email',
            }),
          ],
        }),
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
              TextField({
                code: Format('memberName_%1', Loop.Index0()),
                label: Format('Member %1 name', Loop.Index()),
              }),
            ]),
          ),
        }),
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

export const nestedExpressionIteratorJourney = journey({
  code: 'nested-expression-iterator',
  path: '/nested-expression-iterator',
  title: 'Nested expression iterator',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/teams',
      title: 'Teams',
      reachability: { entryWhen: true },
      blocks: [
        StaticText({
          text: Format(
            '%1',
            Data('teams').each(
              Iterator.Map(
                Item()
                  .path('members')
                  .each(
                    Iterator.Map(
                      Format(
                        '%1:%2:%3:%4',
                        Loop.Parent.Index0(),
                        Loop.Index0(),
                        Item().parent.path('name'),
                        Item().path('name'),
                      ),
                    ),
                  )
                  .pipe(Transformer.Array.Join('|')),
              ),
            ),
          ),
        }),
      ],
    }),
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
      blocks: [StaticText({ text: 'Some info' })],
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
      blocks: [TextField({ code: 'minValue' }), TextField({ code: 'maxValue' })],
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
      blocks: [TextField({ code: 'fullName' })],
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
      blocks: [TextField({ code: 'email' })],
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
          blocks: [TextField({ code: 'fullName' })],
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
        TextField({
          code: 'firstName',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
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
      blocks: [TextField({ code: 'lastName' })],
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
      blocks: [TextField({ code: 'fullName' })],
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
        TextField({
          code: 'trimmedField',
          formatters: [Transformer.String.Trim()],
          parsers: [Transformer.String.Trim()],
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter a value',
            }),
          ],
        }),
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
        TextField({
          code: 'fullName',
          parsers: [Transformer.String.ToUpperCase()],
        }),
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
        RadioField({
          code: 'contactMethod',
          items: [
            { value: 'email', text: 'Email' },
            { value: 'phone', text: 'Phone' },
          ],
        }),
        TextField({
          code: 'emailAddress',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
        }),
        TextField({
          code: 'fullName',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your full name',
            }),
          ],
        }),
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
      blocks: [StaticText({ text: Answer('missingField').pipe(Transformer.String.ToUpperCase()) })],
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
        RadioField({
          code: 'choice',
          items: [
            {
              value: 'yes',
              text: 'Yes',
              block: TextField({
                code: 'detail',
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

export const unusualNestedBlockCodesJourney = journey({
  code: 'unusual-nested-block-codes',
  path: '/unusual-nested-block-codes',
  title: 'Unusual nested block codes',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        RadioField({
          code: 'choice',
          items: [
            { value: 'reserved', text: 'Reserved', block: TextField({ code: 'class' }) },
            { value: 'punctuated', text: 'Punctuated', block: TextField({ code: 'audit.log' }) },
            { value: 'numeric', text: 'Numeric', block: TextField({ code: '123 detail' }) },
          ],
        }),
      ],
    }),
  ],
})
