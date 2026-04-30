import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKPanel } from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  HtmlBlock,
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

const basicExample = GovUKPanel({
  titleText: 'Application complete',
  text: 'Your reference number is HDJ2123F',
})

const referenceExample = GovUKPanel({
  titleText: 'Application complete',
  html: 'Your reference number<br><strong>HDJ2123F</strong>',
})

const blocksExample = GovUKPanel({
  titleText: 'Application complete',
  blocks: [HtmlBlock({ content: 'Your reference number<br><strong>HDJ2123F</strong>' })],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-govuk-components/src/components/panel/govukPanel.ts',
  names: ['GovUKPanelProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'reference-example': [liveDisplay([referenceExample])],
    'blocks-example': [liveDisplay([blocksExample])],
  },
})
