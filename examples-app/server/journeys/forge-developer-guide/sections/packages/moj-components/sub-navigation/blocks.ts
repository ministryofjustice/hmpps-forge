import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJSubNavigation } from '@ministryofjustice/hmpps-forge/moj-components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

function liveDisplay(blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template: '{{slot:content}}',
    classes: 'live-example',
    slots: { content: blocks },
  })
}

const basicExample = MOJSubNavigation({
  label: 'Case sections',
  items: [
    { text: 'Overview', href: '#overview', active: true },
    { text: 'Documents', href: '#documents' },
    { text: 'Timeline', href: '#timeline' },
  ],
})

const itemsExample = MOJSubNavigation({
  label: 'Case sections',
  items: [
    { text: 'Overview', href: '#overview' },
    { text: 'Documents', href: '#documents', active: true },
    { text: 'Timeline', href: '#timeline' },
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'items-example': [liveDisplay([itemsExample])],
  },
})
