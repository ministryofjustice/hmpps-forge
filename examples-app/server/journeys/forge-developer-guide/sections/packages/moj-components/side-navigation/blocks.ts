import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJSideNavigation } from '@ministryofjustice/hmpps-forge/moj-components'
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

const basicExample = MOJSideNavigation({
  label: 'Case navigation',
  items: [
    { text: 'Overview', href: '#overview', active: true },
    { text: 'People', href: '#people' },
    { text: 'Timeline', href: '#timeline' },
  ],
})

const sectionsExample = MOJSideNavigation({
  label: 'Case navigation',
  sections: [
    {
      heading: { text: 'Case', headingLevel: 3 },
      items: [
        { text: 'Overview', href: '#overview', active: true },
        { text: 'Timeline', href: '#timeline' },
      ],
    },
    {
      heading: { text: 'Manage', headingLevel: 3 },
      items: [{ text: 'Documents', href: '#documents' }],
    },
  ],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-moj-components/src/components/side-navigation/mojSideNavigation.ts',
  names: [
    'MOJSideNavigationHeading',
    'MOJSideNavigationItem',
    'MOJSideNavigationSection',
    'MOJSideNavigationProps',
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'sections-example': [liveDisplay([sectionsExample])],
  },
})
