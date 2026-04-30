import {
  Data,
  Request,
  validation,
  Self,
  Condition,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKSelectInput,
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
  basic: 'example-select-basic',
  relationship: 'example-select-relationship',
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

const basicExample = GovUKSelectInput({
  code: 'exampleSelectBasic',
  label: 'Country',
  items: [
    { value: '', text: 'Choose a country' },
    { value: 'uk', text: 'United Kingdom' },
    { value: 'fr', text: 'France' },
    { value: 'de', text: 'Germany' },
    { value: 'es', text: 'Spain' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select a country',
      groups: [EXAMPLE_GROUPS.basic],
    }),
  ],
})

const relationshipExample = GovUKSelectInput({
  code: 'exampleSelectRelationship',
  label: {
    text: 'Relationship',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  items: [
    { value: '', text: 'Choose a relationship' },
    { value: 'partner', text: 'Partner or spouse' },
    { value: 'parent', text: 'Parent' },
    { value: 'child', text: 'Son or daughter' },
    { value: 'sibling', text: 'Brother or sister' },
    { value: 'friend', text: 'Friend' },
    { value: 'other', text: 'Other' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select your relationship',
      groups: [EXAMPLE_GROUPS.relationship],
    }),
  ],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-govuk-components/src/components/select-input/govukSelectInput.ts',
  names: ['SelectItem', 'GovUKSelectInputProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveExample(EXAMPLE_GROUPS.basic, [basicExample])],
    'relationship-example': [liveExample(EXAMPLE_GROUPS.relationship, [relationshipExample])],
  },
})
