import {
  Data,
  Request,
  validation,
  Self,
  Condition,
  Transformer,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKTextareaInput,
  GovUKButton,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'
import { SourceInterfaceSnippet } from '../../shared/sourceInterfaceSnippet'

export const EXAMPLE_GROUPS = {
  basic: 'example-textarea-basic',
  description: 'example-textarea-description',
  notes: 'example-textarea-notes',
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

const basicExample = GovUKTextareaInput({
  code: 'exampleTextareaBasic',
  label: 'Give your feedback',
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your feedback',
      groups: [EXAMPLE_GROUPS.basic],
    }),
  ],
})

const descriptionExample = GovUKTextareaInput({
  code: 'exampleTextareaDescription',
  label: {
    text: 'Describe the incident',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  hint: 'Include the date, time, and location.',
  rows: '8',
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a description of the incident',
      groups: [EXAMPLE_GROUPS.description],
    }),
    validation({
      condition: Self().match(Condition.String.HasMaxLength(2000)),
      message: 'Description must be 2,000 characters or less',
      groups: [EXAMPLE_GROUPS.description],
    }),
  ],
})

const notesExample = GovUKTextareaInput({
  code: 'exampleTextareaNotes',
  label: 'Additional notes',
  hint: 'Enter any extra information, or "None".',
  rows: '3',
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter additional notes or "None"',
      groups: [EXAMPLE_GROUPS.notes],
    }),
  ],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-govuk-components/src/components/textarea-input/govukTextareaInput.ts',
  names: ['GovUKTextareaInputProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveExample(EXAMPLE_GROUPS.basic, [basicExample])],
    'description-example': [liveExample(EXAMPLE_GROUPS.description, [descriptionExample])],
    'notes-example': [liveExample(EXAMPLE_GROUPS.notes, [notesExample])],
  },
})
