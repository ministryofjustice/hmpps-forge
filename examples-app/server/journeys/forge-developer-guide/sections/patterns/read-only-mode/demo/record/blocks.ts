import {
  Answer,
  Format,
  Session,
  Condition,
  Self,
  Transformer,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKInsetText,
  GovUKSummaryList,
  GovUKTextInput,
  GovUKButton,
  GovUKLinkButton,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

const isAdmin = Session('demoUser.role').match(Condition.Equals('admin'))
const isViewer = Session('demoUser.role').match(Condition.Equals('viewer'))

export const heading = GovUKHeading({ text: 'Contact record', size: 'l' })

export const roleMessage = GovUKBody({
  text: Format('Signed in as %1 (%2).', Session('demoUser.name'), Session('demoUser.role')),
})

export const viewerNotice = GovUKInsetText({
  text: 'You have read-only access to this record.',
  visibleWhen: isViewer,
})

export const summaryList = GovUKSummaryList({
  rows: [
    {
      key: { text: 'Name' },
      value: { text: Answer('recordName') },
    },
    {
      key: { text: 'Email' },
      value: { text: Answer('recordEmail') },
    },
    {
      key: { text: 'Department' },
      value: { text: Answer('recordDepartment') },
    },
  ],
  visibleWhen: isViewer,
})

export const editHeading = GovUKHeading({
  text: 'Edit record',
  size: 'm',
  visibleWhen: isAdmin,
})

export const nameField = GovUKTextInput({
  code: 'recordName',
  label: { text: 'Name' },
  classes: GovUKUtilityClasses.Input.Width20,
  formatters: [Transformer.String.Trim()],
  visibleWhen: isAdmin,
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a name',
    }),
  ],
})

export const emailField = GovUKTextInput({
  code: 'recordEmail',
  label: { text: 'Email' },
  classes: GovUKUtilityClasses.Input.Width20,
  visibleWhen: isAdmin,
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter an email address',
    }),
  ],
})

export const departmentField = GovUKTextInput({
  code: 'recordDepartment',
  label: { text: 'Department' },
  classes: GovUKUtilityClasses.Input.Width20,
  visibleWhen: isAdmin,
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a department',
    }),
  ],
})

export const saveButton = GovUKButton({
  text: 'Save changes',
  visibleWhen: isAdmin,
})

export const backButton = GovUKLinkButton({
  text: 'Back to contacts',
  href: '/forge-developer-guide/patterns/demos/read-only-mode/contacts',
  classes: 'govuk-button--secondary',
})
