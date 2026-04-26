import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJTimeline } from '@ministryofjustice/hmpps-forge/moj-components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

function liveDisplay(blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template: '{{slot:content}}',
    classes: 'live-example',
    slots: { content: blocks },
  })
}

const basicExample = MOJTimeline({
  items: [
    {
      label: { text: 'Application approved' },
      text: 'The visit request was approved.',
      datetime: { timestamp: '2026-04-24T14:30:00.000Z', type: 'datetime' },
      byline: { text: 'Caseworker 1' },
    },
  ],
})

const eventsExample = MOJTimeline({
  headingLevel: 3,
  items: [
    {
      label: { text: 'Application approved' },
      text: 'The visit request was approved.',
      datetime: { timestamp: '2026-04-24T14:30:00.000Z', type: 'datetime' },
      byline: { text: 'Caseworker 1' },
    },
    {
      label: { text: 'Application submitted' },
      html: '<p>The visitor submitted the request online.</p>',
      datetime: { timestamp: '2026-04-23T09:15:00.000Z', type: 'datetime' },
      byline: { text: 'Visitor' },
    },
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'events-example': [liveDisplay([eventsExample])],
  },
})
