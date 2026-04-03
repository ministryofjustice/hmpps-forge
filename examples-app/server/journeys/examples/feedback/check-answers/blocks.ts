import { Answer, Condition, Format, match } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKSummaryList,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Check your answers before sending your feedback',
})

export const summaryList = GovUKSummaryList({
  rows: [
    {
      key: { text: 'Name' },
      value: { text: Answer('fullName') },
      actions: { items: [{ href: 'name', text: 'Change', visuallyHiddenText: 'name' }] },
    },
    {
      key: { text: 'Feedback' },
      value: { text: Answer('feedback') },
      actions: {
        items: [{ href: 'your-feedback', text: 'Change', visuallyHiddenText: 'feedback' }],
      },
    },
    {
      key: { text: 'Contact method' },
      value: {
        text: match(Answer('contactMethod'))
          .branch(Condition.Equals('email'), Format('Email (%1)', Answer('email')))
          .branch(Condition.Equals('phone'), Format('Phone (%1)', Answer('phoneNumber')))
          .branch(Condition.Equals('text'), Format('Text message (%1)', Answer('mobileNumber')))
          .otherwise(''),
      },
      actions: {
        items: [
          {
            href: 'contact-method',
            text: 'Change',
            visuallyHiddenText: 'contact method',
          },
        ],
      },
    },
  ],
})

export const confirmationBody = GovUKBody({
  text: 'By sending this feedback you are confirming that, to the best of your knowledge, the details you are providing are correct.',
})

export const submitButton = GovUKButton({ text: 'Send feedback' })
