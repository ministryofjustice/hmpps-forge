import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJSortableTable } from '@ministryofjustice/hmpps-forge/moj-components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

function liveDisplay(blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template: '{{slot:content}}',
    classes: 'live-example',
    slots: { content: blocks },
  })
}

const head = [
  { html: '<button>Name</button>' },
  { html: '<button>Date</button>' },
  { html: '<button>Status</button>' },
]

const rows = [
  [{ text: 'John Smith' }, { text: '2026-04-24' }, { text: 'Active' }],
  [{ text: 'Jane Doe' }, { text: '2026-04-25' }, { text: 'Pending' }],
]

const basicExample = MOJSortableTable({ head, rows })

const captionExample = MOJSortableTable({
  caption: 'Appointments',
  captionClasses: 'govuk-table__caption--m',
  head,
  rows,
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'caption-example': [liveDisplay([captionExample])],
  },
})
