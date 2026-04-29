import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKBreadcrumbs } from '@ministryofjustice/hmpps-forge/govuk-components'
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

const basicExample = GovUKBreadcrumbs({
  items: [{ text: 'Home', href: '#' }, { text: 'Cases', href: '#' }, { text: 'Case details' }],
})

const collapsedExample = GovUKBreadcrumbs({
  collapseOnMobile: true,
  items: [
    { text: 'Home', href: '#' },
    { text: 'Cases', href: '#' },
    { text: 'Active cases', href: '#' },
    { text: 'Case details' },
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'collapsed-example': [liveDisplay([collapsedExample])],
  },
})
