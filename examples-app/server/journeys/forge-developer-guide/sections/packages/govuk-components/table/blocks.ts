import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKTable } from '@ministryofjustice/hmpps-forge/govuk-components'
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

const basicExample = GovUKTable({
  rows: [
    [{ text: 'January' }, { text: '£85' }],
    [{ text: 'February' }, { text: '£165' }],
    [{ text: 'March' }, { text: '£230' }],
  ],
})

const headerExample = GovUKTable({
  head: [{ text: 'Month' }, { text: 'Amount' }],
  rows: [
    [{ text: 'January' }, { text: '£85' }],
    [{ text: 'February' }, { text: '£165' }],
    [{ text: 'March' }, { text: '£230' }],
  ],
})

const captionExample = GovUKTable({
  caption: 'Monthly expenses',
  captionClasses: 'govuk-table__caption--m',
  head: [{ text: 'Month' }, { text: 'Amount' }],
  rows: [
    [{ text: 'January' }, { text: '£85' }],
    [{ text: 'February' }, { text: '£165' }],
    [{ text: 'March' }, { text: '£230' }],
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'header-example': [liveDisplay([headerExample])],
    'caption-example': [liveDisplay([captionExample])],
  },
})
