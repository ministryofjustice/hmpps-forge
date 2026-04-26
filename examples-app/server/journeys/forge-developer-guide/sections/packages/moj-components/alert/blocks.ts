import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { MOJAlert } from '@ministryofjustice/hmpps-forge/moj-components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

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

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveDisplay([basicExample])],
    'variants-example': [liveDisplay([variantsExample])],
  },
})
