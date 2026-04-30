import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKSectionBreak, GovUKBody } from '@ministryofjustice/hmpps-forge/govuk-components'
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

const basicExample = TemplateWrapper({
  template: '{{slot:content}}',
  slots: {
    content: [
      GovUKBody({ text: 'Content above the break.' }),
      GovUKSectionBreak({ size: 'l', visible: true }),
      GovUKBody({ text: 'Content below the break.' }),
    ],
  },
})

const sizesExample = TemplateWrapper({
  template: '{{slot:content}}',
  slots: {
    content: [
      GovUKBody({ text: 'Extra large break (xl)', size: 's' }),
      GovUKSectionBreak({ size: 'xl', visible: true }),
      GovUKBody({ text: 'Large break (l)', size: 's' }),
      GovUKSectionBreak({ size: 'l', visible: true }),
      GovUKBody({ text: 'Medium break (m)', size: 's' }),
      GovUKSectionBreak({ size: 'm', visible: true }),
      GovUKBody({ text: 'Default break', size: 's' }),
      GovUKSectionBreak({ visible: true }),
    ],
  },
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-govuk-components/src/wrappers/govukSectionBreak.ts',
  names: ['SectionBreakSize', 'GovUKSectionBreakProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'sizes-example': [liveDisplay([sizesExample])],
  },
})
