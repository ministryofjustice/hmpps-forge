import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJMessages } from '@ministryofjustice/hmpps-forge/moj-components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

function liveDisplay(blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template: '{{slot:content}}',
    classes: 'live-example',
    slots: { content: blocks },
  })
}

const basicExample = MOJMessages({
  label: 'Case correspondence',
  items: [
    {
      id: 1,
      text: 'Can you confirm the visit time?',
      type: 'sent',
      sender: 'Caseworker',
      timestamp: '2026-04-24T10:00:00.000Z',
    },
  ],
})

const threadExample = MOJMessages({
  label: 'Case correspondence',
  items: [
    {
      id: 1,
      text: 'Can you confirm the visit time?',
      type: 'sent',
      sender: 'Caseworker',
      timestamp: '2026-04-24T10:00:00.000Z',
    },
    {
      id: 2,
      text: 'The visitor confirmed 2pm.',
      type: 'received',
      sender: 'Visits team',
      timestamp: '2026-04-24T10:15:00.000Z',
    },
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'thread-example': [liveDisplay([threadExample])],
  },
})
