import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJCardGroup } from '@ministryofjustice/hmpps-forge/moj-components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

function liveDisplay(blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template: '{{slot:content}}',
    classes: 'live-example',
    slots: { content: blocks },
  })
}

const basicExample = MOJCardGroup({
  items: [
    { heading: 'Search cases', href: '#search', description: 'Find and manage case records.' },
    { heading: 'Reports', href: '#reports', description: 'View service reports.' },
    { heading: 'Tasks', href: '#tasks', description: 'Review work assigned to your team.' },
  ],
})

const columnsExample = MOJCardGroup({
  columns: 2,
  items: [
    { heading: 'People', href: '#people', description: 'Manage people records.' },
    { heading: 'Appointments', href: '#appointments', description: 'Manage upcoming visits.' },
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'columns-example': [liveDisplay([columnsExample])],
  },
})
