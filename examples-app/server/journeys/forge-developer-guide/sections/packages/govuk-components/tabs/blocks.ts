import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKTabs } from '@ministryofjustice/hmpps-forge/govuk-components'
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

const basicExample = GovUKTabs({
  id: 'example-tabs-basic',
  items: [
    {
      id: 'active',
      label: 'Active',
      panel: {
        html: '<h2 class="govuk-heading-m">Active cases</h2><p class="govuk-body">You have 3 active cases.</p>',
      },
    },
    {
      id: 'closed',
      label: 'Closed',
      panel: {
        html: '<h2 class="govuk-heading-m">Closed cases</h2><p class="govuk-body">You have 12 closed cases.</p>',
      },
    },
    {
      id: 'archived',
      label: 'Archived',
      panel: {
        html: '<h2 class="govuk-heading-m">Archived cases</h2><p class="govuk-body">You have 5 archived cases.</p>',
      },
    },
  ],
})

const htmlExample = GovUKTabs({
  id: 'example-tabs-schedule',
  items: [
    {
      id: 'monday',
      label: 'Monday',
      panel: {
        html: '<h2 class="govuk-heading-m">Monday</h2><p class="govuk-body">9am to 5pm</p>',
      },
    },
    {
      id: 'tuesday',
      label: 'Tuesday',
      panel: {
        html: '<h2 class="govuk-heading-m">Tuesday</h2><p class="govuk-body">10am to 4pm</p>',
      },
    },
    {
      id: 'wednesday',
      label: 'Wednesday',
      panel: {
        html: '<h2 class="govuk-heading-m">Wednesday</h2><p class="govuk-body">9am to 5pm</p>',
      },
    },
  ],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-govuk-components/src/components/tabs/govukTabs.ts',
  names: ['TabPanel', 'TabItem', 'GovUKTabsProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'html-example': [liveDisplay([htmlExample])],
  },
})
