import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  HtmlBlock,
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJTicketPanel } from '@ministryofjustice/hmpps-forge/moj-components'
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

const summaryHtml = '<h2 class="govuk-heading-m">Application submitted</h2><p>Reference: ABC123</p>'

const basicExample = MOJTicketPanel({
  items: [
    {
      html: summaryHtml,
      classes: 'moj-ticket-panel__content--green',
    },
  ],
})

const sectionsExample = MOJTicketPanel({
  attributes: { 'aria-label': 'Application summary' },
  items: [
    {
      html: summaryHtml,
      classes: 'moj-ticket-panel__content--green',
    },
    {
      text: 'We will email you within 24 hours to confirm your application.',
    },
  ],
})

const blocksExample = MOJTicketPanel({
  items: [
    {
      blocks: [HtmlBlock({ content: summaryHtml })],
      classes: 'moj-ticket-panel__content--green',
    },
  ],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-moj-components/src/components/ticket-panel/mojTicketPanel.ts',
  names: ['MOJTicketPanelColor', 'MOJTicketPanelItem', 'MOJTicketPanelProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'sections-example': [liveDisplay([sectionsExample])],
    'blocks-example': [liveDisplay([blocksExample])],
  },
})
