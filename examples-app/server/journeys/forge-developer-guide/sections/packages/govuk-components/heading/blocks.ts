import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading } from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

function liveDisplay(blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template: '{{slot:content}}',
    classes: 'live-example',
    slots: { content: blocks },
  })
}

const basicExample = GovUKHeading({ text: 'Page title', size: 'l', level: 2 })

const sizesExample = TemplateWrapper({
  template: '{{slot:content}}',
  slots: {
    content: [
      GovUKHeading({ text: 'Extra large heading', size: 'xl', level: 2 }),
      GovUKHeading({ text: 'Large heading', size: 'l', level: 3 }),
      GovUKHeading({ text: 'Medium heading', size: 'm', level: 4 }),
      GovUKHeading({ text: 'Small heading', size: 's', level: 4 }),
    ],
  },
})

const captionExample = GovUKHeading({
  text: 'Personal details',
  size: 'l',
  level: 2,
  caption: 'Section 1 of 4',
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'sizes-example': [liveDisplay([sizesExample])],
    'caption-example': [liveDisplay([captionExample])],
  },
})
