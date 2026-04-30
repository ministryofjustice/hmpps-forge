import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKBody } from '@ministryofjustice/hmpps-forge/govuk-components'
import { MOJTimeline } from '@ministryofjustice/hmpps-forge/moj-components'
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

const blocksExample = MOJTimeline({
  items: [
    {
      label: { text: 'Application submitted' },
      blocks: [
        GovUKBody({
          text: 'The visitor submitted the request online.',
          classes: 'govuk-!-margin-bottom-0',
        }),
      ],
      datetime: { timestamp: '2026-04-23T09:15:00.000Z', type: 'datetime' },
      byline: { text: 'Visitor' },
    },
  ],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-moj-components/src/components/timeline/mojTimeline.ts',
  names: [
    'MOJTimelineItemLabel',
    'MOJTimelineItemDatetime',
    'MOJTimelineItemByline',
    'MOJTimelineItem',
    'MOJTimelineProps',
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'events-example': [liveDisplay([eventsExample])],
    'blocks-example': [liveDisplay([blocksExample])],
  },
})
