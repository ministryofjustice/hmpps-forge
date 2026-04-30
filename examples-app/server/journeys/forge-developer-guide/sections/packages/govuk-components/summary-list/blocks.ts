import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKBody, GovUKSummaryList } from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'
import { SourceInterfaceSnippet } from '../../shared/sourceInterfaceSnippet'

function liveDisplay(blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template: '{{slot:content}}',
    classes: 'live-example',
    slots: { content: blocks },
  })
}

const basicExample = GovUKSummaryList({
  rows: [
    { key: { text: 'Name' }, value: { text: 'Sarah Philips' } },
    { key: { text: 'Date of birth' }, value: { text: '5 January 1978' } },
    {
      key: { text: 'Address' },
      value: { html: '72 Guild Street<br>London<br>SE23 6FH' },
    },
    { key: { text: 'Contact details' }, value: { text: '07700 900457' } },
  ],
})

const actionsExample = GovUKSummaryList({
  rows: [
    {
      key: { text: 'Name' },
      value: { text: 'Sarah Philips' },
      actions: {
        items: [{ href: '#', text: 'Change', visuallyHiddenText: 'name' }],
      },
    },
    {
      key: { text: 'Date of birth' },
      value: { text: '5 January 1978' },
      actions: {
        items: [{ href: '#', text: 'Change', visuallyHiddenText: 'date of birth' }],
      },
    },
    {
      key: { text: 'Contact details' },
      value: { text: '07700 900457' },
      actions: {
        items: [{ href: '#', text: 'Change', visuallyHiddenText: 'contact details' }],
      },
    },
  ],
})

const cardExample = GovUKSummaryList({
  card: {
    title: { text: 'Personal details' },
    actions: {
      items: [{ href: '#', text: 'Delete', classes: 'govuk-link--destructive' }],
    },
  },
  rows: [
    { key: { text: 'Name' }, value: { text: 'Sarah Philips' } },
    { key: { text: 'Email' }, value: { text: 'sarah.philips@example.com' } },
    { key: { text: 'Role' }, value: { text: 'Senior caseworker' } },
  ],
})

const blocksExample = GovUKSummaryList({
  rows: [
    {
      key: { text: 'Address' },
      value: {
        blocks: [
          GovUKBody({ text: '72 Guild Street' }),
          GovUKBody({ text: 'London' }),
          GovUKBody({ text: 'SE23 6FH', classes: 'govuk-!-margin-bottom-0' }),
        ],
      },
    },
  ],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-govuk-components/src/components/summary-list/govukSummaryList.ts',
  names: ['SummaryListValue', 'SummaryListRow', 'GovUKSummaryListProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'actions-example': [liveDisplay([actionsExample])],
    'card-example': [liveDisplay([cardExample])],
    'blocks-example': [liveDisplay([blocksExample])],
  },
})
