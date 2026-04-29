import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKPagination } from '@ministryofjustice/hmpps-forge/govuk-components'
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

const basicExample = GovUKPagination({
  previous: { href: '#' },
  next: { href: '#' },
})

const numberedExample = GovUKPagination({
  previous: { href: '#' },
  next: { href: '#' },
  items: [
    { number: '1', href: '#' },
    { number: '2', href: '#', current: true },
    { number: '3', href: '#' },
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'numbered-example': [liveDisplay([numberedExample])],
  },
})
