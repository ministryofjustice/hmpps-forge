import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKTaskList } from '@ministryofjustice/hmpps-forge/govuk-components'
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

const basicExample = GovUKTaskList({
  items: [
    {
      title: { text: 'Personal details' },
      status: { tag: { text: 'Completed', classes: 'govuk-tag--blue' } },
    },
    {
      title: { text: 'Contact information' },
      status: { tag: { text: 'Incomplete', classes: 'govuk-tag--grey' } },
    },
    {
      title: { text: 'Upload documents' },
      status: { text: 'Not yet started' },
    },
  ],
})

const linkedExample = GovUKTaskList({
  items: [
    {
      title: { text: 'Your details' },
      hint: { text: 'Your name and relationship to the prisoner' },
      href: '#',
      status: { tag: { text: 'Completed', classes: 'govuk-tag--blue' } },
    },
    {
      title: { text: 'Visit preferences' },
      hint: { text: 'When you want to visit and the type of visit' },
      href: '#',
      status: { tag: { text: 'Incomplete', classes: 'govuk-tag--grey' } },
    },
    {
      title: { text: 'Additional needs' },
      href: '#',
      status: { tag: { text: 'Not started', classes: 'govuk-tag--grey' } },
    },
  ],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-govuk-components/src/components/task-list/govukTaskList.ts',
  names: [
    'TaskListStatusTag',
    'TaskListStatus',
    'TaskListTitle',
    'TaskListHint',
    'TaskListItem',
    'GovUKTaskListProps',
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'linked-example': [liveDisplay([linkedExample])],
  },
})
