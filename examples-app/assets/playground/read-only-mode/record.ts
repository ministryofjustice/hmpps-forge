import { access, submit, redirect, step, Answer, Format, Session, Condition, Self, Transformer, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContact, saveContact } from './effects'
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

const heading = GovUKHeading({ text: 'Contact record', size: 'l' })

const roleMessage = GovUKBody({
  text: Format('Signed in as %1 (%2).', Session('demoUser.name'), Session('demoUser.role')),
})

const viewerNotice = GovUKInsetText({
  text: 'You have read-only access to this record.',
  visibleWhen: isViewer,
})

const summaryList = GovUKSummaryList({
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

const editHeading = GovUKHeading({
  text: 'Edit record',
  size: 'm',
  visibleWhen: isAdmin,
})

const nameField = GovUKTextInput({
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

const emailField = GovUKTextInput({
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

const departmentField = GovUKTextInput({
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

const saveButton = GovUKButton({
  text: 'Save changes',
  visibleWhen: isAdmin,
})

const backButton = GovUKLinkButton({
  text: 'Back to contacts',
  href: '/read-only-mode/contacts',
  classes: 'govuk-button--secondary',
})

export const recordStep = step({
  code: 'record',
  path: '/record/:index',
  title: 'Contact record',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      next: [redirect({ when: Session('demoUser').not.match(Condition.IsRequired()), goto: 'login' })],
    }),
    access({
      effects: [loadContact()],
    }),
  ],
  blocks: [
    heading,
    roleMessage,
    viewerNotice,
    summaryList,
    editHeading,
    nameField,
    emailField,
    departmentField,
    saveButton,
    backButton,
  ],
  onSubmission: [
    submit({
      when: isAdmin,
      validate: true,
      onValid: {
        effects: [saveContact()],
        next: [redirect({ goto: '../contacts' })],
      },
    }),
  ],
})
