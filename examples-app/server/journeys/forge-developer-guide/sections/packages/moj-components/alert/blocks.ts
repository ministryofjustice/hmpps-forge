import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKBody } from '@ministryofjustice/hmpps-forge/govuk-components'
import { MOJAlert } from '@ministryofjustice/hmpps-forge/moj-components'
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

const basicExample = MOJAlert({
  alertVariant: 'success',
  title: 'Application submitted',
  text: 'Your changes have been saved successfully.',
  showTitleAsHeading: true,
})

const variantsExample = TemplateWrapper({
  template: '{{slot:information}}{{slot:success}}{{slot:warning}}{{slot:error}}',
  slots: {
    information: [
      MOJAlert({
        alertVariant: 'information',
        title: 'Information',
        text: 'A new case note was added.',
      }),
    ],
    success: [
      MOJAlert({ alertVariant: 'success', title: 'Success', text: 'The record was updated.' }),
    ],
    warning: [
      MOJAlert({
        alertVariant: 'warning',
        title: 'Warning',
        text: 'This person has active alerts.',
      }),
    ],
    error: [
      MOJAlert({ alertVariant: 'error', title: 'Error', text: 'The record could not be saved.' }),
    ],
  },
})

const blocksExample = MOJAlert({
  alertVariant: 'warning',
  title: 'Check the risk information',
  blocks: [
    GovUKBody({
      text: 'Review the case history before continuing.',
      classes: 'govuk-!-margin-bottom-0',
    }),
  ],
})

const interfaceSnippet = SourceInterfaceSnippet({
  sourcePath: 'forge-moj-components/src/components/alert/mojAlert.ts',
  names: ['MOJAlertVariant', 'MOJAlertHeadingTag', 'MOJAlertProps'],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    interface: [interfaceSnippet],
    'basic-example': [liveDisplay([basicExample])],
    'variants-example': [liveDisplay([variantsExample])],
    'blocks-example': [liveDisplay([blocksExample])],
  },
})
