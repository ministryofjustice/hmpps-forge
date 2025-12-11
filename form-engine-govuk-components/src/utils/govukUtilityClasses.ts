/**
 * GOV.UK Design System utility CSS classes.
 *
 * These classes can be used to modify component appearance without
 * writing custom CSS. Use them in field definitions via the `classes` property.
 *
 * @see https://design-system.service.gov.uk/
 */
export const govukUtilityClasses = {
  /** Hide content visually while keeping it accessible to screen readers */
  visuallyHidden: 'govuk-visually-hidden',

  /** Display radio buttons horizontally instead of stacked */
  inlineRadios: 'govuk-radios-inline',

  /** Use smaller radio button styling */
  smallRadios: 'govuk-radios-small',

  /** Fieldset legend size modifiers */
  Fieldset: {
    /** Large legend text (typically for page headings) */
    largeLabel: 'govuk-fieldset__legend--l',

    /** Medium legend text */
    mediumLabel: 'govuk-fieldset__legend--m',

    /** Small legend text */
    smallLabel: 'govuk-fieldset__legend--s',
  },
}
