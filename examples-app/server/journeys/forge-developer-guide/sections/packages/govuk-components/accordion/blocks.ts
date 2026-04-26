import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKAccordion } from '@ministryofjustice/hmpps-forge/govuk-components'
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

const basicExample = GovUKAccordion({
  id: 'example-accordion-basic',
  items: [
    {
      heading: { text: 'Writing well for the web' },
      content: {
        text: 'This is the content for Writing well for the web. People do not usually read content unless they want information. Use the inverted pyramid structure and front-load content.',
      },
    },
    {
      heading: { text: 'Writing well for specialists' },
      content: {
        text: 'This is the content for Writing well for specialists. If you are writing for a specialist audience, you can use technical terms they will understand.',
      },
    },
    {
      heading: { text: 'Know your audience' },
      content: {
        text: 'This is the content for Know your audience. Your writing will be most effective if you understand who you are writing for.',
      },
    },
  ],
})

const summaryExample = GovUKAccordion({
  id: 'example-accordion-summary',
  items: [
    {
      heading: { text: 'Understanding agile' },
      summary: { text: 'Principles, values, and best practices' },
      content: {
        text: 'Agile is an iterative approach to project management and software development. Teams deliver work in small, consumable increments.',
      },
    },
    {
      heading: { text: 'Working in sprints' },
      summary: { text: 'Planning, standups, and retrospectives' },
      content: {
        text: 'Sprints are short, time-boxed periods when a team works to complete a set amount of work. Sprints are usually one to four weeks long.',
      },
    },
    {
      heading: { text: 'User research' },
      summary: { text: 'Understanding user needs through research' },
      content: {
        text: 'User research helps teams understand what users need. Use a mix of qualitative and quantitative methods to build evidence.',
      },
    },
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'summary-example': [liveDisplay([summaryExample])],
  },
})
