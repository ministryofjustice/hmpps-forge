import { Data, Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKList } from '@ministryofjustice/hmpps-forge/govuk-components'
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

const basicExample = GovUKList({
  items: Literal(['Design', 'Build', 'Test', 'Deploy']),
  type: 'bullet',
})

const bulletExample = GovUKList({
  items: Literal(['Design', 'Build', 'Test']),
  type: 'bullet',
})

const numberedExample = GovUKList({
  items: Literal(['Check eligibility', 'Gather documents', 'Submit application']),
  type: 'number',
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-govuk-components/src/wrappers/govukList.ts',
  names: ['ListType', 'IterableDataSource', 'GovUKListProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'bullet-example': [liveDisplay([bulletExample])],
    'numbered-example': [liveDisplay([numberedExample])],
  },
})
