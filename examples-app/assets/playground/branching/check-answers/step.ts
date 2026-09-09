import { Answer, Condition, Transformer, match, submit, redirect, Session, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKBody, GovUKSummaryList, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveAnswers, saveSubmitStateToSession, clearDraftAnswers } from '../effects'

const heading = GovUKHeading({
  text: 'Check your answers',
})

// visitTypeLabel uses match() to pick a friendly display value for the row
// that is always shown. The three branch rows each declare visibleWhen, so
// only the branch the user actually took appears on the summary. Answers
// from other branches stay in the session (so switching back shows the
// previous value pre-filled) but are not displayed here.
const visitTypeLabel = match(Answer('visitType'))
  .branch(Condition.Equals('in-person'), 'In person')
  .branch(Condition.Equals('video'), 'Video call')
  .branch(Condition.Equals('phone'), 'Phone call')
  .otherwise('')

const summaryList = GovUKSummaryList({
  rows: [
    {
      key: { text: 'How you would like to meet' },
      value: { text: visitTypeLabel },
      actions: {
        items: [
          { href: 'visit-type', text: 'Change', visuallyHiddenText: 'how you would like to meet' },
        ],
      },
    },
    {
      visibleWhen: Answer('visitType').match(Condition.Equals('in-person')),
      key: { text: 'Office' },
      value: { text: Answer('location').pipe(Transformer.String.Capitalize()) },
      actions: {
        items: [{ href: 'location', text: 'Change', visuallyHiddenText: 'office' }],
      },
    },
    {
      visibleWhen: Answer('visitType').match(Condition.Equals('video')),
      key: { text: 'Invite email' },
      value: { text: Answer('videoEmail') },
      actions: {
        items: [{ href: 'video-email', text: 'Change', visuallyHiddenText: 'invite email' }],
      },
    },
    {
      visibleWhen: Answer('visitType').match(Condition.Equals('phone')),
      key: { text: 'Phone number' },
      value: { text: Answer('phoneNumber') },
      actions: {
        items: [{ href: 'phone-number', text: 'Change', visuallyHiddenText: 'phone number' }],
      },
    },
  ],
})

const confirmBody = GovUKBody({
  text: 'Selecting "Confirm" will save your answers.',
})

const submitButton = GovUKButton({ text: 'Confirm' })

export const checkAnswersStep = step({
  code: 'check-answers',
  path: '/check-answers',
  title: 'Check your answers',
  blocks: [heading, summaryList, confirmBody, submitButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [
          // Keep confirmed answers in memory, mark submitted, then clear drafts
          saveAnswers('branching'),
          saveSubmitStateToSession('branching', true),
          clearDraftAnswers('branching'),
        ],
        next: [
          redirect({
            // Gate on session state so the redirect only fires after the effects
            // above have run — the session value survives ClearDraftAnswers.
            when: Session('patternSubmitted.branching').match(Condition.Equals(true)),
            goto: 'confirmation',
          }),
        ],
      },
    }),
  ],
})
