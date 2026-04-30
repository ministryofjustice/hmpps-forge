import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJFilter } from '@ministryofjustice/hmpps-forge/moj-components'
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

const optionsHtml = `
  <div class="govuk-form-group">
    <label class="govuk-label" for="status">Status</label>
    <select class="govuk-select" id="status" name="status">
      <option value="">Any status</option>
      <option value="open">Open</option>
      <option value="closed">Closed</option>
    </select>
  </div>
`

const basicExample = MOJFilter({
  heading: { text: 'Filter' },
  submit: { text: 'Apply filters' },
  optionsHtml,
})

const selectedExample = MOJFilter({
  heading: { text: 'Filter' },
  selectedFilters: {
    heading: { text: 'Selected filters' },
    clearLink: { href: '#clear', text: 'Clear filters' },
    categories: [
      {
        heading: { text: 'Status' },
        items: [{ text: 'Open', href: '#remove-open' }],
      },
    ],
  },
  submit: { text: 'Apply filters' },
  optionsHtml,
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-moj-components/src/components/filter/mojFilter.ts',
  names: [
    'MOJFilterHeading',
    'MOJFilterClearLink',
    'MOJFilterTagItem',
    'MOJFilterCategory',
    'MOJFilterSelectedFilters',
    'MOJFilterSubmit',
    'MOJFilterProps',
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'selected-example': [liveDisplay([selectedExample])],
  },
})
