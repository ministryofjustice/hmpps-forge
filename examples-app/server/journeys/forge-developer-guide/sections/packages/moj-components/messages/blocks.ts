import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKBody } from '@ministryofjustice/hmpps-forge/govuk-components'
import { MOJMessages } from '@ministryofjustice/hmpps-forge/moj-components'
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

const blocksExample = MOJMessages({
  items: [
    {
      blocks: [
        GovUKBody({ text: 'See the updated risk assessment.', classes: 'govuk-!-margin-bottom-0' }),
      ],
      type: 'received',
      sender: 'Risk team',
      timestamp: '2026-04-24T11:00:00.000Z',
    },
  ],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-moj-components/src/components/messages/mojMessages.ts',
  names: ['MOJMessageType', 'MOJMessageItem', 'MOJMessagesProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'thread-example': [liveDisplay([threadExample])],
    'blocks-example': [liveDisplay([blocksExample])],
  },
})
