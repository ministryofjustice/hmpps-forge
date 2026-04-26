import {
  Data,
  Request,
  validation,
  Self,
  Condition,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKPasswordInput,
  GovUKButton,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  TemplateWrapper,
  type BlockDefinition,
} from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKMarkdownBlock } from '../../../../components/govukMarkdown'
import { TableOfContents } from '../../../../components/tableOfContents'

export const EXAMPLE_GROUPS = {
  basic: 'example-password-basic',
  hint: 'example-password-hint',
} as const

function liveExample(group: string, blocks: BlockDefinition[]) {
  return TemplateWrapper({
    template:
      '<input type="hidden" name="_csrf" value="{{csrfToken}}">{{slot:content}}{{slot:button}}',
    tag: 'form',
    classes: 'live-example',
    attributes: { method: 'post', novalidate: '' },
    values: { csrfToken: Request.State('csrfToken') },
    slots: {
      content: blocks,
      button: [GovUKButton({ text: 'Submit', value: group })],
    },
  })
}

const basicExample = GovUKPasswordInput({
  code: 'examplePassword',
  label: 'Password',
  autocomplete: 'current-password',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your password',
      groups: [EXAMPLE_GROUPS.basic],
    }),
  ],
})

const hintExample = GovUKPasswordInput({
  code: 'exampleNewPassword',
  label: {
    text: 'Create a password',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  hint: 'Your password must be at least 8 characters and contain at least one number.',
  autocomplete: 'new-password',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a password',
      groups: [EXAMPLE_GROUPS.hint],
    }),
  ],
})

export const content = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
    'basic-example': [liveExample(EXAMPLE_GROUPS.basic, [basicExample])],
    'hint-example': [liveExample(EXAMPLE_GROUPS.hint, [hintExample])],
  },
})
