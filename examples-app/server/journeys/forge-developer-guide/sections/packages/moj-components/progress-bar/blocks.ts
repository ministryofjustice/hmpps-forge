import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJProgressBar } from '@ministryofjustice/hmpps-forge/moj-components'
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

const basicExample = MOJProgressBar({
  label: 'Application progress',
  items: [
    { label: 'Personal details', complete: true },
    { label: 'Contact information', active: true },
    { label: 'Review and submit' },
  ],
})

const longExample = MOJProgressBar({
  label: 'Visit booking progress',
  items: [
    { label: 'Choose prisoner', complete: true },
    { label: 'Choose date', complete: true },
    { label: 'Visitor details', active: true },
    { label: 'Check answers' },
  ],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-moj-components/src/components/progress-bar/mojProgressBar.ts',
  names: ['MOJProgressBarItemLabel', 'MOJProgressBarItem', 'MOJProgressBarProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'long-example': [liveDisplay([longExample])],
  },
})
