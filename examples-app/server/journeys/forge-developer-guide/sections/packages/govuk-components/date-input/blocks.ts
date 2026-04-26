import { Data, Request } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKDateInputFull,
  GovUKButton,
  GovUKUtilityClasses,
  GovUKValidations,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

export const EXAMPLE_GROUPS = {
  basic: 'example-date-basic',
  validation: 'example-date-validation',
  startDate: 'example-date-start',
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

function withGroups(
  validations: ReturnType<typeof GovUKValidations.DateInputFull>,
  groups: string[],
) {
  return validations.map(v => ({ ...v, groups }))
}

const basicExample = GovUKDateInputFull({
  code: 'exampleDateBasic',
  fieldset: {
    legend: { text: 'Date of birth' },
  },
  hint: 'For example, 27 3 1990',
  validWhen: withGroups(
    GovUKValidations.DateInputFull({
      empty: 'Enter a date of birth',
      missingDay: 'Date of birth must include a day',
      missingMonth: 'Date of birth must include a month',
      missingYear: 'Date of birth must include a year',
      invalid: 'Date of birth must be a real date',
    }),
    [EXAMPLE_GROUPS.basic],
  ),
})

const validationExample = GovUKDateInputFull({
  code: 'exampleDateValidation',
  fieldset: {
    legend: {
      text: 'What is your date of birth?',
      classes: GovUKUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: false,
    },
  },
  hint: 'For example, 27 3 1990',
  validWhen: withGroups(
    GovUKValidations.DateInputFull({
      empty: 'Enter your date of birth',
      missingDay: 'Date of birth must include a day',
      missingMonth: 'Date of birth must include a month',
      missingYear: 'Date of birth must include a year',
      invalid: 'Date of birth must be a real date',
      mustBePast: { message: 'Date of birth must be in the past', submissionOnly: true },
    }),
    [EXAMPLE_GROUPS.validation],
  ),
})

const startDateExample = GovUKDateInputFull({
  code: 'exampleDateStart',
  fieldset: {
    legend: { text: 'When do you want to start?' },
  },
  hint: 'For example, 27 3 2025',
  validWhen: withGroups(
    GovUKValidations.DateInputFull({
      empty: 'Enter a start date',
      missingDay: 'Start date must include a day',
      missingMonth: 'Start date must include a month',
      missingYear: 'Start date must include a year',
      invalid: 'Start date must be a real date',
      mustBeFuture: { message: 'Start date must be in the future', submissionOnly: true },
    }),
    [EXAMPLE_GROUPS.startDate],
  ),
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveExample(EXAMPLE_GROUPS.basic, [basicExample])],
    'validation-example': [liveExample(EXAMPLE_GROUPS.validation, [validationExample])],
    'start-date-example': [liveExample(EXAMPLE_GROUPS.startDate, [startDateExample])],
  },
})
