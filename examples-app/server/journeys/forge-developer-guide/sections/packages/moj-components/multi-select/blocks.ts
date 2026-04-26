import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJMultiSelect } from '@ministryofjustice/hmpps-forge/moj-components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

function liveDisplay(blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template: '{{slot:content}}',
    classes: 'live-example',
    slots: { content: blocks },
  })
}

function checkboxHtml(id: string, name: string, value: string) {
  return `<input type="checkbox" class="govuk-checkboxes__input" id="${id}" name="${name}" value="${value}">`
}

const rows = [
  [{ html: checkboxHtml('person-1', 'people', '1') }, { text: 'John Smith' }, { text: 'Active' }],
  [{ html: checkboxHtml('person-2', 'people', '2') }, { text: 'Jane Doe' }, { text: 'Pending' }],
]

const basicExample = MOJMultiSelect({
  head: [
    { html: checkboxHtml('select-all', 'selectAll', 'all') },
    { text: 'Name' },
    { text: 'Status' },
  ],
  rows,
})

const captionExample = MOJMultiSelect({
  caption: 'People to allocate',
  captionClasses: 'govuk-table__caption--m',
  head: [
    { html: checkboxHtml('select-people', 'selectAllPeople', 'all') },
    { text: 'Name' },
    { text: 'Status' },
  ],
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
