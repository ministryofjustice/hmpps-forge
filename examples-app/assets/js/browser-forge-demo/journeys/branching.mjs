import {
  Answer,
  Condition,
  Self,
  Transformer,
  access,
  condition,
  createForgePackage,
  journey,
  match,
  redirect,
  step,
  submit,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKButton,
  GovUKHeading,
  GovUKRadioInput,
  GovUKSummaryList,
  GovUKTextInput,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { ClearDraft, LoadDraft, SaveDraft } from '../effects.mjs'

/**
 * The branching pattern, running fully client-side: one radio answer picks
 * which of three follow-up steps the user visits, and the check-answers page
 * shows only the branch they took. A straight copy of the server-rendered
 * pattern demo, minus the guide's code panels.
 */

const visitTypeStep = step({
  code: 'visit-type',
  path: '/visit-type',
  title: 'How would you like to meet?',
  reachability: { entryWhen: true },
  blocks: [
    GovUKRadioInput({
      code: 'visitType',
      fieldset: {
        legend: {
          text: 'How would you like to meet?',
          classes: GovUKUtilityClasses.Fieldset.LargeLabel,
          isPageHeading: true,
        },
      },
      hint: { text: 'Pick the option that works best for you.' },
      items: [
        { value: 'in-person', text: 'In person' },
        { value: 'video', text: 'Video call' },
        { value: 'phone', text: 'Phone call' },
      ],
      validWhen: [
        validation({
          condition: Self().match(Condition.IsRequired()),
          message: 'Select how you would like to meet',
        }),
      ],
    }),
    GovUKButton({ text: 'Continue' }),
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [SaveDraft('branching')],
        // The branching happens here: the next[] array is evaluated in order
        // and the first redirect whose `when` matches wins.
        next: [
          redirect({ when: Answer('visitType').match(Condition.Equals('in-person')), goto: 'location' }),
          redirect({ when: Answer('visitType').match(Condition.Equals('video')), goto: 'video-email' }),
          redirect({ when: Answer('visitType').match(Condition.Equals('phone')), goto: 'phone-number' }),
        ],
      },
    }),
  ],
})

const locationStep = step({
  code: 'location',
  path: '/location',
  title: 'Which office would you like to visit?',
  blocks: [
    GovUKRadioInput({
      code: 'location',
      fieldset: {
        legend: {
          text: 'Which office would you like to visit?',
          classes: GovUKUtilityClasses.Fieldset.LargeLabel,
          isPageHeading: true,
        },
      },
      items: [
        { value: 'london', text: 'London' },
        { value: 'manchester', text: 'Manchester' },
        { value: 'cardiff', text: 'Cardiff' },
        { value: 'edinburgh', text: 'Edinburgh' },
      ],
      validWhen: [
        validation({
          condition: Self().match(Condition.IsRequired()),
          message: 'Select an office',
        }),
      ],
    }),
    GovUKButton({ text: 'Continue' }),
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [SaveDraft('branching')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})

const videoEmailStep = step({
  code: 'video-email',
  path: '/video-email',
  title: 'What email should we send the invite to?',
  blocks: [
    GovUKTextInput({
      code: 'videoEmail',
      label: {
        text: 'What email should we send the invite to?',
        classes: GovUKUtilityClasses.Label.Large,
        isPageHeading: true,
      },
      hint: { text: 'We will send a calendar invite with the video call details.' },
      inputType: 'email',
      autocomplete: 'email',
      classes: GovUKUtilityClasses.Input.Width20,
      formatters: [Transformer.String.Trim(), Transformer.String.ToLowerCase()],
      validWhen: [
        validation({
          condition: Self().match(Condition.IsRequired()),
          message: 'Enter an email address',
        }),
        validation({
          condition: Self().match(Condition.Email.IsValidEmail()),
          message: 'Enter a valid email address',
        }),
        validation({
          // The invite must reach the visitor themselves, not a shared inbox.
          condition: Self().match(
            condition({
              factory: () => value => typeof value === 'string' && !/^(info|admin|office|enquiries)@/.test(value),
            })(),
          ),
          message: 'Enter a personal email address, not a shared inbox',
        }),
      ],
    }),
    GovUKButton({ text: 'Continue' }),
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [SaveDraft('branching')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})

const phoneNumberStep = step({
  code: 'phone-number',
  path: '/phone-number',
  title: 'What number should we call you on?',
  blocks: [
    GovUKTextInput({
      code: 'phoneNumber',
      label: {
        text: 'What number should we call you on?',
        classes: GovUKUtilityClasses.Label.Large,
        isPageHeading: true,
      },
      hint: { text: 'We will only use this number for the call.' },
      inputType: 'tel',
      autocomplete: 'tel',
      classes: GovUKUtilityClasses.Input.Width20,
      formatters: [Transformer.String.Trim()],
      validWhen: [
        validation({
          condition: Self().match(Condition.IsRequired()),
          message: 'Enter a phone number',
        }),
      ],
    }),
    GovUKButton({ text: 'Continue' }),
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [SaveDraft('branching')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})

const visitTypeLabel = match(Answer('visitType'))
  .branch(Condition.Equals('in-person'), 'In person')
  .branch(Condition.Equals('video'), 'Video call')
  .branch(Condition.Equals('phone'), 'Phone call')
  .otherwise('')

const checkAnswersStep = step({
  code: 'check-answers',
  path: '/check-answers',
  title: 'Check your answers',
  blocks: [
    GovUKHeading({ text: 'Check your answers' }),
    // The three branch rows each declare visibleWhen, so only the branch the
    // user actually took appears. Answers from other branches stay in the
    // draft (switching back shows the previous value pre-filled).
    GovUKSummaryList({
      rows: [
        {
          key: { text: 'How you would like to meet' },
          value: { text: visitTypeLabel },
          actions: {
            items: [
              {
                href: '/browser-demo/branching/visit-type',
                text: 'Change',
                visuallyHiddenText: 'how you would like to meet',
              },
            ],
          },
        },
        {
          visibleWhen: Answer('visitType').match(Condition.Equals('in-person')),
          key: { text: 'Office' },
          value: { text: Answer('location').pipe(Transformer.String.Capitalize()) },
          actions: {
            items: [{ href: '/browser-demo/branching/location', text: 'Change', visuallyHiddenText: 'office' }],
          },
        },
        {
          visibleWhen: Answer('visitType').match(Condition.Equals('video')),
          key: { text: 'Invite email' },
          value: { text: Answer('videoEmail') },
          actions: {
            items: [
              { href: '/browser-demo/branching/video-email', text: 'Change', visuallyHiddenText: 'invite email' },
            ],
          },
        },
        {
          visibleWhen: Answer('visitType').match(Condition.Equals('phone')),
          key: { text: 'Phone number' },
          value: { text: Answer('phoneNumber') },
          actions: {
            items: [
              { href: '/browser-demo/branching/phone-number', text: 'Change', visuallyHiddenText: 'phone number' },
            ],
          },
        },
      ],
    }),
    GovUKButton({ text: 'Confirm booking' }),
  ],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        next: [redirect({ goto: 'confirmation' })],
      },
    }),
  ],
})

const confirmationStep = step({
  code: 'confirmation',
  path: '/confirmation',
  title: 'Booking confirmed',
  blocks: [GovUKHeading({ text: 'Booking confirmed' }), GovUKButton({ text: 'Start again' })],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [ClearDraft('branching')],
        next: [redirect({ goto: 'visit-type' })],
      },
    }),
  ],
})

export const branchingJourney = journey({
  code: 'branching',
  title: 'Branching',
  path: '/browser-demo/branching',
  view: { locals: { browserDemoSection: 'branching' } },
  onAccess: [access({ effects: [LoadDraft('branching')] })],
  steps: [visitTypeStep, locationStep, videoEmailStep, phoneNumberStep, checkAnswersStep, confirmationStep],
})

export const branchingPackage = createForgePackage({ journey: branchingJourney })
