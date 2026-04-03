import {
  Answer,
  Condition,
  match,
  Transformer,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKSummaryList,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({ text: 'Check your answers before booking' })

// FORGE-EXAMPLE: match() inside summary list values renders different text per branch.
export const summaryList = GovUKSummaryList({
  rows: [
    {
      key: { text: 'Appointment type' },
      value: {
        text: match(Answer('appointmentType'))
          .branch(Condition.Equals('in-person'), 'In person')
          .branch(Condition.Equals('phone'), 'Phone call')
          .branch(Condition.Equals('video'), 'Video call')
          .otherwise(''),
      },
      actions: {
        items: [{ href: 'type', text: 'Change', visuallyHiddenText: 'appointment type' }],
      },
    },
    {
      key: { text: 'Name' },
      value: { text: Answer('fullName') },
      actions: {
        items: [{ href: 'your-details', text: 'Change', visuallyHiddenText: 'name' }],
      },
    },
    {
      key: { text: 'Email' },
      value: { text: Answer('email') },
      actions: {
        items: [{ href: 'your-details', text: 'Change', visuallyHiddenText: 'email address' }],
      },
    },
    {
      key: { text: 'Date' },
      value: {
        text: Answer('appointmentDate').pipe(
          Transformer.String.ToDate(),
          Transformer.Date.Format('D MMMM YYYY'),
        ),
      },
      actions: {
        items: [{ href: 'choose-date', text: 'Change', visuallyHiddenText: 'appointment date' }],
      },
    },
    {
      key: { text: 'Time' },
      value: { text: Answer('appointmentTime') },
      actions: {
        items: [{ href: 'choose-time', text: 'Change', visuallyHiddenText: 'appointment time' }],
      },
    },
  ],
})

export const confirmationBody = GovUKBody({
  text: 'By booking this appointment you are confirming that, to the best of your knowledge, the details you are providing are correct.',
})

export const submitButton = GovUKButton({ text: 'Book appointment' })
