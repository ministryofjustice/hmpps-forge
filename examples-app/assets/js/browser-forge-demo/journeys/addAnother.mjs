import {
  Answer,
  Condition,
  Format,
  Item,
  Iterator,
  Loop,
  Post,
  Self,
  access,
  createForgePackage,
  journey,
  match,
  redirect,
  step,
  submit,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKButton,
  GovUKButtonGroup,
  GovUKHeading,
  GovUKInsetText,
  GovUKSelectInput,
  GovUKSummaryList,
  GovUKTextInput,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { ClearDraft, LoadDraft, SaveDraft, AddItemToCollection, DeleteItemFromCollection, EditItemInCollection, LoadItemForEdit } from '../effects.mjs'

/**
 * The add-another pattern, running fully client-side: a collection of contacts
 * rendered as summary cards, with add, edit, and delete flows appending to,
 * replacing in, and splicing from the `contacts` answer. A straight copy of
 * the server-rendered pattern demo, minus the guide's code panels.
 */

const CONTACT_FIELD_CODES = ['contactName', 'contactRelationship', 'contactPhone']

const relationshipLabel = value =>
  match(value)
    .branch(Condition.Equals('partner'), 'Partner')
    .branch(Condition.Equals('parent'), 'Parent')
    .branch(Condition.Equals('sibling'), 'Sibling')
    .branch(Condition.Equals('child'), 'Child')
    .branch(Condition.Equals('friend'), 'Friend')
    .branch(Condition.Equals('colleague'), 'Colleague')
    .branch(Condition.Equals('other'), 'Other')
    .otherwise('')

const contactCards = CollectionBlock({
  collection: Answer('contacts').each(
    Iterator.Map(
      GovUKSummaryList({
        card: {
          title: { text: Item().path('contactName') },
          actions: {
            items: [
              {
                href: Format('/browser-demo/add-another/edit-contact/%1', Loop.Index0()),
                text: 'Change',
                visuallyHiddenText: Item().path('contactName'),
              },
              {
                href: Format('/browser-demo/add-another/delete-contact/%1', Loop.Index0()),
                text: 'Remove',
                visuallyHiddenText: Item().path('contactName'),
              },
            ],
          },
        },
        rows: [
          {
            key: { text: 'Relationship' },
            value: { text: relationshipLabel(Item().path('contactRelationship')) },
          },
          {
            key: { text: 'Phone number' },
            value: { text: Item().path('contactPhone') },
          },
        ],
      }),
    ),
  ),
  fallback: [GovUKInsetText({ text: 'You have not added any emergency contacts yet.' })],
})

const yourContactsStep = step({
  code: 'your-contacts',
  path: '/your-contacts',
  title: 'Your emergency contacts',
  reachability: { entryWhen: true },
  blocks: [
    GovUKHeading({ text: 'Your emergency contacts', size: 'l' }),
    contactCards,
    GovUKButtonGroup({
      buttons: [
        GovUKButton({
          text: 'Add another contact',
          classes: 'govuk-button--secondary',
          name: 'action',
          value: 'add-another',
        }),
        GovUKButton({ text: 'Continue', name: 'action', value: 'continue' }),
      ],
    }),
  ],
  // Step-level validation: at least one contact before the user can continue.
  validWhen: [
    validation({
      condition: Answer('contacts').match(Condition.IsRequired()),
      message: 'Add at least one emergency contact',
    }),
  ],
  onSubmission: [
    // "Add another" skips validation so the user is never blocked from adding
    // their first contact when the collection is empty.
    submit({
      when: Post('action').match(Condition.Equals('add-another')),
      validate: false,
      onAlways: {
        effects: [SaveDraft('add-another')],
        next: [redirect({ goto: 'add-contact' })],
      },
    }),
    submit({
      when: Post('action').match(Condition.Equals('continue')),
      validate: true,
      onValid: {
        next: [redirect({ goto: 'confirmation' })],
      },
    }),
  ],
})

const contactFields = [
  GovUKTextInput({
    code: 'contactName',
    label: { text: 'Full name', classes: GovUKUtilityClasses.Label.Medium },
    validWhen: [
      validation({
        condition: Self().match(Condition.IsRequired()),
        message: 'Enter a full name',
        submissionOnly: true,
      }),
    ],
  }),
  GovUKSelectInput({
    code: 'contactRelationship',
    label: { text: 'Relationship', classes: GovUKUtilityClasses.Label.Medium },
    items: [
      { value: '', text: 'Choose a relationship' },
      { value: 'partner', text: 'Partner' },
      { value: 'parent', text: 'Parent' },
      { value: 'sibling', text: 'Sibling' },
      { value: 'child', text: 'Child' },
      { value: 'friend', text: 'Friend' },
      { value: 'colleague', text: 'Colleague' },
      { value: 'other', text: 'Other' },
    ],
    validWhen: [
      validation({
        condition: Self().match(Condition.IsRequired()),
        message: 'Select a relationship',
        submissionOnly: true,
      }),
    ],
  }),
  GovUKTextInput({
    code: 'contactPhone',
    label: { text: 'Phone number', classes: GovUKUtilityClasses.Label.Medium },
    validWhen: [
      validation({
        condition: Self().match(Condition.IsRequired()),
        message: 'Enter a phone number',
        submissionOnly: true,
      }),
    ],
  }),
  GovUKButton({ text: 'Save and continue' }),
]

const addContactStep = step({
  code: 'add-contact',
  path: '/add-contact',
  title: 'Add an emergency contact',
  // Entry point so this page stays reachable even when the list page's
  // validWhen rule fails (empty collection blocks forward propagation).
  reachability: { entryWhen: true },
  blocks: [GovUKHeading({ text: 'Add an emergency contact', size: 'l' }), ...contactFields],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [AddItemToCollection('contacts', CONTACT_FIELD_CODES), SaveDraft('add-another')],
        next: [redirect({ goto: 'your-contacts' })],
      },
    }),
  ],
})

const editContactStep = step({
  code: 'edit-contact',
  // :index is extracted from the URL automatically by Forge.
  path: '/edit-contact/:index',
  title: 'Change emergency contact',
  reachability: { entryWhen: true },
  blocks: [GovUKHeading({ text: 'Change emergency contact', size: 'l' }), ...contactFields],
  onAccess: [
    access({
      effects: [LoadItemForEdit('add-another', 'contacts', CONTACT_FIELD_CODES)],
    }),
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [EditItemInCollection('add-another', 'contacts', CONTACT_FIELD_CODES), SaveDraft('add-another')],
        next: [redirect({ goto: 'your-contacts' })],
      },
    }),
  ],
})

const deleteContactStep = step({
  code: 'delete-contact',
  path: '/delete-contact/:index',
  title: 'Are you sure you want to remove this contact?',
  reachability: { entryWhen: true },
  blocks: [
    GovUKHeading({ text: 'Are you sure you want to remove this contact?', size: 'l' }),
    GovUKButtonGroup({
      buttons: [
        GovUKButton({ text: 'Yes, remove contact', classes: 'govuk-button--warning' }),
        GovUKButton({
          text: 'Cancel',
          classes: 'govuk-button--secondary',
          href: '/browser-demo/add-another/your-contacts',
        }),
      ],
    }),
  ],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [DeleteItemFromCollection('contacts'), SaveDraft('add-another')],
        next: [redirect({ goto: 'your-contacts' })],
      },
    }),
  ],
})

const confirmationStep = step({
  code: 'confirmation',
  path: '/confirmation',
  title: 'Contacts saved',
  blocks: [GovUKHeading({ text: 'Contacts saved', size: 'l' }), GovUKButton({ text: 'Start again' })],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [ClearDraft('add-another')],
        next: [redirect({ goto: 'your-contacts' })],
      },
    }),
  ],
})

export const addAnotherJourney = journey({
  code: 'add-another',
  title: 'Add another',
  path: '/browser-demo/add-another',
  view: { locals: { browserDemoSection: 'add-another' } },
  onAccess: [access({ effects: [LoadDraft('add-another')] })],
  steps: [yourContactsStep, addContactStep, editContactStep, deleteContactStep, confirmationStep],
})

export const addAnotherPackage = createForgePackage({ journey: addAnotherJourney })
