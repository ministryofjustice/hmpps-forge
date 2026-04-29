import {
  Data,
  Request,
  validation,
  Self,
  Answer,
  Condition,
  Transformer,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKRadioInput,
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
  basic: 'example-radio-basic',
  inline: 'example-radio-inline',
  divider: 'example-radio-divider',
  reveal: 'example-radio-reveal',
  singleQuestion: 'example-radio-single-question',
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

const basicExample = GovUKRadioInput({
  code: 'exampleRadioBasic',
  fieldset: {
    legend: { text: 'How would you prefer to be contacted?' },
  },
  items: [
    { value: 'email', text: 'Email' },
    { value: 'phone', text: 'Phone' },
    { value: 'post', text: 'Post' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select how you would prefer to be contacted',
      groups: [EXAMPLE_GROUPS.basic],
    }),
  ],
})

const inlineExample = GovUKRadioInput({
  code: 'exampleRadioInline',
  fieldset: {
    legend: { text: 'Do you have a passport?' },
  },
  classes: GovUKUtilityClasses.Radios.Inline,
  items: [
    { value: 'yes', text: 'Yes' },
    { value: 'no', text: 'No' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select yes if you have a passport',
      groups: [EXAMPLE_GROUPS.inline],
    }),
  ],
})

const dividerExample = GovUKRadioInput({
  code: 'exampleRadioDivider',
  fieldset: {
    legend: { text: 'Where do you live?' },
  },
  items: [
    { value: 'england', text: 'England' },
    { value: 'scotland', text: 'Scotland' },
    { value: 'wales', text: 'Wales' },
    { value: 'northern-ireland', text: 'Northern Ireland' },
    { divider: 'or' },
    { value: 'abroad', text: 'I live abroad' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select where you live',
      groups: [EXAMPLE_GROUPS.divider],
    }),
  ],
})

const revealExample = GovUKRadioInput({
  code: 'exampleRadioReveal',
  fieldset: {
    legend: { text: 'How did you hear about us?' },
  },
  items: [
    { value: 'search-engine', text: 'Search engine' },
    {
      value: 'social-media',
      text: 'Social media',
      block: GovUKTextInput({
        code: 'exampleRevealPlatform',
        label: 'Which platform?',
        dependentWhen: Answer('exampleRadioReveal').match(Condition.Equals('social-media')),
        classes: GovUKUtilityClasses.Input.Width20,
        formatters: [Transformer.String.Trim()],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter the platform where you saw us',
            groups: [EXAMPLE_GROUPS.reveal],
          }),
        ],
      }),
    },
    { value: 'friend', text: 'Friend or colleague' },
    {
      value: 'other',
      text: 'Other',
      block: GovUKTextInput({
        code: 'exampleRevealOther',
        label: 'Please specify',
        dependentWhen: Answer('exampleRadioReveal').match(Condition.Equals('other')),
        classes: GovUKUtilityClasses.Input.Width20,
        formatters: [Transformer.String.Trim()],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter where you heard about us',
            groups: [EXAMPLE_GROUPS.reveal],
          }),
        ],
      }),
    },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select how you heard about us',
      groups: [EXAMPLE_GROUPS.reveal],
    }),
  ],
})

const singleQuestionExample = GovUKRadioInput({
  code: 'exampleRadioSingleQuestion',
  fieldset: {
    legend: {
      text: 'How would you like to meet?',
      classes: GovUKUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: false,
    },
  },
  hint: 'Pick the option that works best for you.',
  items: [
    { value: 'in-person', text: 'In person' },
    { value: 'video', text: 'Video call' },
    { value: 'phone', text: 'Phone call' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select how you would like to meet',
      groups: [EXAMPLE_GROUPS.singleQuestion],
    }),
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveExample(EXAMPLE_GROUPS.basic, [basicExample])],
    'inline-example': [liveExample(EXAMPLE_GROUPS.inline, [inlineExample])],
    'divider-example': [liveExample(EXAMPLE_GROUPS.divider, [dividerExample])],
    'reveal-example': [liveExample(EXAMPLE_GROUPS.reveal, [revealExample])],
    'single-question-example': [
      liveExample(EXAMPLE_GROUPS.singleQuestion, [singleQuestionExample]),
    ],
  },
})
