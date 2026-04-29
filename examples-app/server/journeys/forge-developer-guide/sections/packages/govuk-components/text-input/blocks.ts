import {
  Data,
  Request,
  validation,
  Self,
  Condition,
  Transformer,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
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
  basic: 'example-basic',
  singleQuestion: 'example-single-question',
  postcode: 'example-postcode',
  currency: 'example-currency',
  reference: 'example-reference',
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

const basicExample = GovUKTextInput({
  code: 'exampleBasic',
  label: 'Full name',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your full name',
      groups: [EXAMPLE_GROUPS.basic],
    }),
  ],
})

const singleQuestionExample = GovUKTextInput({
  code: 'exampleSingleQuestion',
  label: {
    text: 'What is your full name?',
    classes: GovUKUtilityClasses.Label.Large,
    isPageHeading: false,
  },
  autocomplete: 'name',
  classes: GovUKUtilityClasses.Input.Width20,
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your full name',
      groups: [EXAMPLE_GROUPS.singleQuestion],
    }),
  ],
})

const postcodeExample = GovUKTextInput({
  code: 'examplePostcode',
  label: 'Postcode',
  hint: 'For example, SW1A 1AA',
  autocomplete: 'postal-code',
  classes: GovUKUtilityClasses.Input.Width10,
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a postcode',
      groups: [EXAMPLE_GROUPS.postcode],
    }),
  ],
})

const currencyExample = GovUKTextInput({
  code: 'exampleCurrency',
  label: 'Annual income before tax',
  hint: 'Round to the nearest pound',
  prefix: { text: '£' },
  inputMode: 'numeric',
  classes: GovUKUtilityClasses.Input.Width10,
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your annual income',
      groups: [EXAMPLE_GROUPS.currency],
    }),
  ],
})

const referenceExample = GovUKTextInput({
  code: 'exampleReference',
  label: 'Case reference number',
  hint: 'This is on the letter we sent you. For example, HDJ2123F.',
  classes: `${GovUKUtilityClasses.Input.Width10} ${GovUKUtilityClasses.Input.ExtraLetterSpacing}`,
  spellcheck: false,
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a case reference number',
      groups: [EXAMPLE_GROUPS.reference],
    }),
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveExample(EXAMPLE_GROUPS.basic, [basicExample])],
    'single-question-example': [
      liveExample(EXAMPLE_GROUPS.singleQuestion, [singleQuestionExample]),
    ],
    'postcode-example': [liveExample(EXAMPLE_GROUPS.postcode, [postcodeExample])],
    'currency-example': [liveExample(EXAMPLE_GROUPS.currency, [currencyExample])],
    'reference-example': [liveExample(EXAMPLE_GROUPS.reference, [referenceExample])],
  },
})
