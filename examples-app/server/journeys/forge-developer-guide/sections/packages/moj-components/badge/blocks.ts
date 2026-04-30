import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJBadge } from '@ministryofjustice/hmpps-forge/moj-components'
import { GovUKTable } from '@ministryofjustice/hmpps-forge/govuk-components'
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

function badgeHtml(text: string, classes: string) {
  return `<strong class="moj-badge ${classes}">${text}</strong>`
}

const basicExample = MOJBadge({
  text: 'Complete',
  classes: 'moj-badge--green',
})

const coloursExample = TemplateWrapper({
  template: '{{slot:table}}',
  slots: {
    table: [
      GovUKTable({
        head: [{ text: 'Badge' }, { text: 'Class' }],
        rows: [
          [
            { html: badgeHtml('Urgent', 'moj-badge--red') },
            { html: '<code>moj-badge--red</code>' },
          ],
          [
            { html: badgeHtml('In review', 'moj-badge--blue') },
            { html: '<code>moj-badge--blue</code>' },
          ],
          [
            { html: badgeHtml('Complete', 'moj-badge--green') },
            { html: '<code>moj-badge--green</code>' },
          ],
          [
            { html: badgeHtml('Paused', 'moj-badge--dark-grey') },
            { html: '<code>moj-badge--dark-grey</code>' },
          ],
        ],
      }),
    ],
  },
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-moj-components/src/components/badge/mojBadge.ts',
  names: ['MOJBadgeColour', 'MOJBadgeProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'colours-example': [liveDisplay([coloursExample])],
  },
})
