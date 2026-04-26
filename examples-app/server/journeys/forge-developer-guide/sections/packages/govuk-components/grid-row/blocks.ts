import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKGridRow, GovUKBody } from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

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

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'widths-example': [liveDisplay([widthsExample])],
  },
})
