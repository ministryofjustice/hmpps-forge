import {
  journey,
  step,
  submitTransition,
  accessTransition,
  redirect,
  validation,
  Self,
  Answer,
  Format,
  Condition,
  Transformer,
} from '@ministryofjustice/hmpps-forge/core/authoring'

import {
  GovUKHeading,
  GovUKBody,
  GovUKTextInput,
  GovUKRadioInput,
  GovUKTextareaInput,
  GovUKButton,
  GovUKPanel,
  GovUKSummaryList,
  GovUKInsetText,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { ExampleJourneysEffects } from '../effects'

// -- Fields --

// FORGE-EXAMPLE: Fields are defined using component helpers (GovUKTextInput, GovUKRadioInput, etc.)
// Each field has a `code` used as its answer key, plus optional validation, formatting, and conditionals.
const fullNameField = GovUKTextInput({
  code: 'fullName',
  label: {
    text: 'What is your name?',
    classes: GovukUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  classes: GovukUtilityClasses.Input.Width20,
  autocomplete: 'name',
  formatters: [Transformer.String.Trim()],
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your full name',
    }),
    validation({
      when: Self().not.match(Condition.String.HasMaxLength(200)),
      message: 'Full name must be 200 characters or less',
    }),
    validation({
      when: Self().not.match(Condition.String.LettersWithSpaceDashApostrophe()),
      message: 'Full name must only include letters, spaces, hyphens and apostrophes',
    }),
  ],
})

const contactMethodField = GovUKRadioInput({
  code: 'contactMethod',
  fieldset: {
    legend: {
      text: 'How should we contact you?',
      classes: GovukUtilityClasses.Label.Large,
      isPageHeading: true,
    },
  },
  items: [
    {
      value: 'email',
      text: 'Email',
      block: GovUKTextInput({
        code: 'email',
        label: 'Email address',
        dependent: Answer('contactMethod').match(Condition.Equals('email')),
        classes: GovukUtilityClasses.Input.Width20,
        inputType: 'email',
        autocomplete: 'email',
        formatters: [Transformer.String.Trim(), Transformer.String.ToLowerCase()],
        validate: [
          validation({
            when: Self().not.match(Condition.IsRequired()),
            message: 'Enter your email address',
          }),
          validation({
            when: Self().not.match(Condition.Email.IsValidEmail()),
            message: 'Enter a valid email address',
          }),
        ],
      }),
    },
    {
      value: 'phone',
      text: 'Phone',
      block: GovUKTextInput({
        code: 'phoneNumber',
        label: 'Phone number',
        dependent: Answer('contactMethod').match(Condition.Equals('phone')),
        classes: GovukUtilityClasses.Input.Width20,
        inputType: 'tel',
        autocomplete: 'tel',
        formatters: [Transformer.String.Trim()],
        validate: [
          validation({
            when: Self().not.match(Condition.IsRequired()),
            message: 'Enter your phone number',
          }),
          validation({
            when: Self().not.match(Condition.Phone.IsValidPhoneNumber()),
            message: 'Enter a valid phone number',
          }),
        ],
      }),
    },
    {
      value: 'text',
      text: 'Text message',
      block: GovUKTextInput({
        code: 'mobileNumber',
        label: 'Mobile number',
        dependent: Answer('contactMethod').match(Condition.Equals('text')),
        classes: GovukUtilityClasses.Input.Width20,
        inputType: 'tel',
        autocomplete: 'tel',
        formatters: [Transformer.String.Trim()],
        validate: [
          validation({
            when: Self().not.match(Condition.IsRequired()),
            message: 'Enter your mobile number',
          }),
          validation({
            when: Self().not.match(Condition.Phone.IsValidUKMobile()),
            message: 'Enter a valid UK mobile number',
          }),
        ],
      }),
    },
  ],
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Select how you would like to be contacted',
    }),
  ],
})

const feedbackField = GovUKTextareaInput({
  code: 'feedback',
  label: {
    text: 'Your feedback',
    classes: GovukUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  hint: { text: 'Do not include personal or financial information' },
  formatters: [Transformer.String.Trim()],
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your feedback',
    }),
    validation({
      when: Self().not.match(Condition.String.HasMaxLength(1200)),
      message: 'Feedback must be 1200 characters or less',
    }),
  ],
})

// -- Steps --

// FORGE-EXAMPLE: Steps compose fields into pages. onSubmission defines what happens on POST:
// validate answers, run effects (e.g. save to data store), and redirect to the next step.
const nameStep = step({
  path: '/name',
  title: 'What is your name?',
  isEntryPoint: true,
  blocks: [fullNameField, GovUKButton({ text: 'Continue' })],
  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('feedback-form')],
        next: [redirect({ goto: 'your-feedback' })],
      },
    }),
  ],
})

const feedbackStep = step({
  path: '/your-feedback',
  title: 'Your feedback',
  backlink: 'name',
  blocks: [feedbackField, GovUKButton({ text: 'Continue' })],
  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('feedback-form')],
        next: [redirect({ goto: 'contact-method' })],
      },
    }),
  ],
})

const contactMethodStep = step({
  path: '/contact-method',
  title: 'How should we contact you?',
  backlink: 'your-feedback',
  blocks: [contactMethodField, GovUKButton({ text: 'Continue' })],
  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('feedback-form')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})

const checkAnswersStep = step({
  path: '/check-answers',
  title: 'Check your answers before sending your feedback',
  backlink: 'your-feedback',
  blocks: [
    GovUKHeading({
      text: 'Check your answers before sending your feedback',
    }),
    GovUKSummaryList({
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
          value: { text: Answer('contactMethod') },
          actions: {
            items: [{ href: 'contact-method', text: 'Change', visuallyHiddenText: 'contact method' }],
          },
        },
      ],
    }),
    GovUKBody({
      text: 'By sending this feedback you are confirming that, to the best of your knowledge, the details you are providing are correct.',
    }),
    GovUKButton({
      text: 'Send feedback',
    }),
  ],
  onSubmission: [
    submitTransition({
      validate: false,
      onAlways: {
        effects: [ExampleJourneysEffects.SaveAnswers('feedback-form')],
        next: [redirect({ goto: 'confirmation' })],
      },
    }),
  ],
})

const confirmationStep = step({
  path: '/confirmation',
  title: 'Feedback sent',
  blocks: [
    GovUKPanel({
      titleText: 'Feedback sent',
    }),
    GovUKHeading({
      text: 'What happens next',
      size: 'm',
      level: 2,
    }),
    GovUKBody({
      text: 'We have sent your feedback to our team. They will review it and get in touch using your preferred contact method.',
    }),
    GovUKInsetText({
      text: Format('You selected to be contacted by %1.', Answer('contactMethod')),
    }),
    GovUKButton({ text: 'Start again' }),
  ],
  onSubmission: [
    submitTransition({
      validate: false,
      onAlways: {
        effects: [ExampleJourneysEffects.ClearAnswers('feedback-form')],
        next: [redirect({ goto: 'name' })],
      },
    }),
  ],
})

// FORGE-EXAMPLE: A journey groups steps into a multi-page flow with a shared path prefix.
// onAccess effects run on every GET, e.g. to load saved answers before rendering.
const feedbackJourney = journey({
  code: 'feedback',
  title: 'Give feedback',
  path: '/feedback',
  view: {
    locals: { serviceName: 'Feedback form' },
  },
  onAccess: [
    accessTransition({
      effects: [ExampleJourneysEffects.LoadAnswers('feedback-form')],
    }),
  ],
  steps: [nameStep, feedbackStep, contactMethodStep, checkAnswersStep, confirmationStep],
})

export default feedbackJourney
export { feedbackJourney }
