import {
  Answer,
  Format,
  Condition,
  Transformer,
  match,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKPanel,
  GovUKHeading,
  GovUKBody,
  GovUKInsetText,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

// FORGE-EXAMPLE:
// Format() supports expression arguments, not just static strings.
// Here match() is used as a Format argument to insert conditional text into the panel body.
export const panel = GovUKPanel({
  titleText: 'Appointment booked',
  html: Format(
    'Your %1 appointment has been booked for %2 at %3.',
    match(Answer('appointmentType'))
      .branch(Condition.Equals('in-person'), 'in-person')
      .branch(Condition.Equals('phone'), 'phone')
      .branch(Condition.Equals('video'), 'video call')
      .otherwise(''),
    Answer('appointmentDate').pipe(
      Transformer.String.ToDate(),
      Transformer.Date.Format('D MMMM YYYY'),
    ),
    Answer('appointmentTime'),
  ),
})

export const whatHappensNextHeading = GovUKHeading({
  text: 'What happens next',
  size: 'm',
  level: 2,
})

export const confirmationEmailBody = GovUKBody({
  text: Format('We have sent a confirmation email to %1.', Answer('email')),
})

export const appointmentDetailsInset = GovUKInsetText({
  text: match(Answer('appointmentType'))
    .branch(
      Condition.Equals('in-person'),
      Format(
        'Your appointment is at the %1 office. We will send directions to your email.',
        Answer('location').pipe(Transformer.String.Capitalize()),
      ),
    )
    .branch(
      Condition.Equals('phone'),
      Format('We will call you on %1 at the time of your appointment.', Answer('phoneNumber')),
    )
    .branch(
      Condition.Equals('video'),
      'A video call link will be sent to your email before the appointment.',
    )
    .otherwise(''),
})

export const bookAnotherButton = GovUKButton({ text: 'Book another appointment' })
