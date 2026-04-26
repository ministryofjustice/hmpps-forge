import {
  Data,
  Request,
  validation,
  Self,
  Answer,
  Condition,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKCheckboxInput,
  GovUKTextInput,
  GovUKButton,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

export const EXAMPLE_GROUPS = {
  basic: 'example-checkbox-basic',
  exclusive: 'example-checkbox-exclusive',
  reveal: 'example-checkbox-reveal',
  singleQuestion: 'example-checkbox-single-question',
} as const

function liveExample(group: string, blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template:
      '<input type="hidden" name="_csrf" value="{{csrfToken}}">{{slot:content}}{{slot:button}}',
    tag: 'form',
    classes: 'live-example',
    attributes: { method: 'post', novalidate: '' },
    values: { csrfToken: Request.State('csrfToken') },
    slots: {
      content: blocks,
      button: [GovUKButton({ text: 'Submit', value: group })],
    },
  })
}

const basicExample = GovUKCheckboxInput({
  code: 'exampleCheckboxBasic',
  fieldset: {
    legend: { text: 'How would you like to be contacted?' },
  },
  hint: 'Select all that apply.',
  items: [
    { value: 'email', text: 'Email' },
    { value: 'phone', text: 'Phone' },
    { value: 'post', text: 'Post' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select how you would like to be contacted',
      groups: [EXAMPLE_GROUPS.basic],
    }),
  ],
})

const exclusiveExample = GovUKCheckboxInput({
  code: 'exampleCheckboxExclusive',
  fieldset: {
    legend: { text: 'Which types of waste do you transport?' },
  },
  hint: 'Select all that apply.',
  items: [
    { value: 'animal', text: 'Waste from animal carcasses' },
    { value: 'mines', text: 'Waste from mines or quarries' },
    { value: 'farm', text: 'Farm or agricultural waste' },
    { divider: 'or' },
    { value: 'none', text: 'I do not transport waste', behaviour: 'exclusive' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message:
        'Select which types of waste you transport, or select that you do not transport waste',
      groups: [EXAMPLE_GROUPS.exclusive],
    }),
  ],
})

const revealExample = GovUKCheckboxInput({
  code: 'exampleCheckboxReveal',
  fieldset: {
    legend: { text: 'How should we notify you?' },
  },
  items: [
    {
      value: 'email',
      text: 'Email',
      block: GovUKTextInput({
        code: 'exampleRevealEmail',
        label: 'Email address',
        inputType: 'email',
        dependentWhen: Answer('exampleCheckboxReveal').match(Condition.Array.Contains('email')),
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter an email address',
            groups: [EXAMPLE_GROUPS.reveal],
          }),
        ],
      }),
    },
    {
      value: 'sms',
      text: 'Text message',
      block: GovUKTextInput({
        code: 'exampleRevealPhone',
        label: 'Phone number',
        inputType: 'tel',
        dependentWhen: Answer('exampleCheckboxReveal').match(Condition.Array.Contains('sms')),
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter a phone number',
            groups: [EXAMPLE_GROUPS.reveal],
          }),
        ],
      }),
    },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select how you would like to be notified',
      groups: [EXAMPLE_GROUPS.reveal],
    }),
  ],
})

const singleQuestionExample = GovUKCheckboxInput({
  code: 'exampleCheckboxSingleQuestion',
  fieldset: {
    legend: {
      text: 'Which countries have you visited?',
      classes: GovUKUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: false,
    },
  },
  hint: 'Select all that apply.',
  items: [
    { value: 'uk', text: 'United Kingdom' },
    { value: 'france', text: 'France' },
    { value: 'germany', text: 'Germany' },
    { value: 'spain', text: 'Spain' },
    { divider: 'or' },
    { value: 'none', text: 'I have not visited any of these', behaviour: 'exclusive' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select which countries you have visited, or select that you have not visited any',
      groups: [EXAMPLE_GROUPS.singleQuestion],
    }),
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveExample(EXAMPLE_GROUPS.basic, [basicExample])],
    'exclusive-example': [liveExample(EXAMPLE_GROUPS.exclusive, [exclusiveExample])],
    'reveal-example': [liveExample(EXAMPLE_GROUPS.reveal, [revealExample])],
    'single-question-example': [
      liveExample(EXAMPLE_GROUPS.singleQuestion, [singleQuestionExample]),
    ],
  },
})
