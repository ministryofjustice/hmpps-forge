import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKGridRow, GovUKBody } from '@ministryofjustice/hmpps-forge/govuk-components'
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

const basicExample = GovUKGridRow({
  columns: [
    { width: 'one-half', blocks: [GovUKBody({ text: 'Left column (one-half)' })] },
    { width: 'one-half', blocks: [GovUKBody({ text: 'Right column (one-half)' })] },
  ],
})

const widthsExample = GovUKGridRow({
  columns: [
    { width: 'two-thirds', blocks: [GovUKBody({ text: 'Main content (two-thirds)' })] },
    { width: 'one-third', blocks: [GovUKBody({ text: 'Sidebar (one-third)' })] },
  ],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-govuk-components/src/wrappers/govukGridRow.ts',
  names: ['GridColumnWidth', 'GovUKGridColumn', 'GovUKGridRowProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'widths-example': [liveDisplay([widthsExample])],
  },
})
