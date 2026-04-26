/**
 * GOV.UK Design System utility CSS classes.
 *
 * These classes can be used to modify component appearance without
 * writing custom CSS. Use them in field definitions via the `classes` property.
 *
 * @see https://design-system.service.gov.uk/
 */
export const GovUKUtilityClasses = {
  /** Hide content visually while keeping it accessible to screen readers */
  VisuallyHidden: 'govuk-visually-hidden',

  /** Hide content visually but make it visible when focused (e.g. skip links) */
  VisuallyHiddenFocusable: 'govuk-visually-hidden-focusable',

  /**
   * Fixed-width input classes. The width roughly corresponds to the number
   * of characters that will fit in the input at the standard font size.
   *
   * @see https://design-system.service.gov.uk/components/text-input/#use-appropriately-sized-text-inputs
   */
  Input: {
    /** 2 character width (e.g. day, age) */
    Width2: 'govuk-input--width-2',

    /** 3 character width (e.g. area code) */
    Width3: 'govuk-input--width-3',

    /** 4 character width (e.g. year, PIN) */
    Width4: 'govuk-input--width-4',

    /** 5 character width (e.g. postcode) */
    Width5: 'govuk-input--width-5',

    /** 10 character width (e.g. phone number) */
    Width10: 'govuk-input--width-10',

    /** 20 character width (e.g. name, email) */
    Width20: 'govuk-input--width-20',

    /** 30 character width (e.g. address line) */
    Width30: 'govuk-input--width-30',

    /** Tabular numbers with extra letter spacing (e.g. reference numbers) */
    ExtraLetterSpacing: 'govuk-input--extra-letter-spacing',
  },

  /** Label size modifiers */
  Label: {
    /** Extra large label (48px, typically for single-field page headings) */
    ExtraLarge: 'govuk-label--xl',

    /** Large label (36px) */
    Large: 'govuk-label--l',

    /** Medium label (24px) */
    Medium: 'govuk-label--m',

    /** Small label (bold, standard size) */
    Small: 'govuk-label--s',
  },

  /** Fieldset legend size modifiers */
  Fieldset: {
    /** Extra large legend text (48px, typically for page headings) */
    ExtraLargeLabel: 'govuk-fieldset__legend--xl',

    /** Large legend text (36px) */
    LargeLabel: 'govuk-fieldset__legend--l',

    /** Medium legend text (24px) */
    MediumLabel: 'govuk-fieldset__legend--m',

    /** Small legend text (bold, standard size) */
    SmallLabel: 'govuk-fieldset__legend--s',
  },

  /** Radio button layout modifiers */
  Radios: {
    /** Display radio buttons horizontally instead of stacked */
    Inline: 'govuk-radios--inline',

    /** Use smaller radio button styling (24px instead of 40px) */
    Small: 'govuk-radios--small',
  },

  /** Checkbox layout modifiers */
  Checkboxes: {
    /** Use smaller checkbox styling (24px instead of 40px) */
    Small: 'govuk-checkboxes--small',
  },

  /**
   * Tag colour variants.
   *
   * @see https://design-system.service.gov.uk/components/tag/
   */
  Tag: {
    Blue: 'govuk-tag--blue',
    Green: 'govuk-tag--green',
    Grey: 'govuk-tag--grey',
    Red: 'govuk-tag--red',
    Orange: 'govuk-tag--orange',
    Yellow: 'govuk-tag--yellow',
    Purple: 'govuk-tag--purple',
    Teal: 'govuk-tag--teal',
    Magenta: 'govuk-tag--magenta',
  },

  /**
   * Responsive width override classes. Full width on mobile,
   * specified fraction on tablet and above.
   *
   * @see https://design-system.service.gov.uk/styles/layout/#width-override-classes
   */
  Width: {
    Full: 'govuk-!-width-full',
    ThreeQuarters: 'govuk-!-width-three-quarters',
    TwoThirds: 'govuk-!-width-two-thirds',
    OneHalf: 'govuk-!-width-one-half',
    OneThird: 'govuk-!-width-one-third',
    OneQuarter: 'govuk-!-width-one-quarter',
  },

  /** Display override classes */
  Display: {
    Inline: 'govuk-!-display-inline',
    InlineBlock: 'govuk-!-display-inline-block',
    Block: 'govuk-!-display-block',
    None: 'govuk-!-display-none',

    /** Hidden in print only */
    NonePrint: 'govuk-!-display-none-print',
  },

  /**
   * Responsive font size overrides.
   *
   * @see https://design-system.service.gov.uk/styles/typography/#font-size
   */
  FontSize: {
    Size16: 'govuk-!-font-size-16',
    Size19: 'govuk-!-font-size-19',
    Size24: 'govuk-!-font-size-24',
    Size27: 'govuk-!-font-size-27',
    Size36: 'govuk-!-font-size-36',
    Size48: 'govuk-!-font-size-48',
    Size80: 'govuk-!-font-size-80',
  },

  /** Font weight overrides */
  FontWeight: {
    Regular: 'govuk-!-font-weight-regular',
    Bold: 'govuk-!-font-weight-bold',
  },

  /** Text alignment overrides */
  TextAlign: {
    Left: 'govuk-!-text-align-left',
    Centre: 'govuk-!-text-align-centre',
    Right: 'govuk-!-text-align-right',
  },

  /**
   * Responsive margin overrides (scale 0–9).
   *
   * Spacing scale: 0=0, 1=5px, 2=10px, 3=15px, 4=20px, 5=25px, 6=30px, 7=40px, 8=50px, 9=60px
   * (values 4–9 are smaller on mobile).
   *
   * @see https://design-system.service.gov.uk/styles/spacing/#spacing-override-classes
   */
  Margin: {
    All0: 'govuk-!-margin-0',
    All1: 'govuk-!-margin-1',
    All2: 'govuk-!-margin-2',
    All3: 'govuk-!-margin-3',
    All4: 'govuk-!-margin-4',
    All5: 'govuk-!-margin-5',
    All6: 'govuk-!-margin-6',
    All7: 'govuk-!-margin-7',
    All8: 'govuk-!-margin-8',
    All9: 'govuk-!-margin-9',

    Top0: 'govuk-!-margin-top-0',
    Top1: 'govuk-!-margin-top-1',
    Top2: 'govuk-!-margin-top-2',
    Top3: 'govuk-!-margin-top-3',
    Top4: 'govuk-!-margin-top-4',
    Top5: 'govuk-!-margin-top-5',
    Top6: 'govuk-!-margin-top-6',
    Top7: 'govuk-!-margin-top-7',
    Top8: 'govuk-!-margin-top-8',
    Top9: 'govuk-!-margin-top-9',

    Right0: 'govuk-!-margin-right-0',
    Right1: 'govuk-!-margin-right-1',
    Right2: 'govuk-!-margin-right-2',
    Right3: 'govuk-!-margin-right-3',
    Right4: 'govuk-!-margin-right-4',
    Right5: 'govuk-!-margin-right-5',
    Right6: 'govuk-!-margin-right-6',
    Right7: 'govuk-!-margin-right-7',
    Right8: 'govuk-!-margin-right-8',
    Right9: 'govuk-!-margin-right-9',

    Bottom0: 'govuk-!-margin-bottom-0',
    Bottom1: 'govuk-!-margin-bottom-1',
    Bottom2: 'govuk-!-margin-bottom-2',
    Bottom3: 'govuk-!-margin-bottom-3',
    Bottom4: 'govuk-!-margin-bottom-4',
    Bottom5: 'govuk-!-margin-bottom-5',
    Bottom6: 'govuk-!-margin-bottom-6',
    Bottom7: 'govuk-!-margin-bottom-7',
    Bottom8: 'govuk-!-margin-bottom-8',
    Bottom9: 'govuk-!-margin-bottom-9',

    Left0: 'govuk-!-margin-left-0',
    Left1: 'govuk-!-margin-left-1',
    Left2: 'govuk-!-margin-left-2',
    Left3: 'govuk-!-margin-left-3',
    Left4: 'govuk-!-margin-left-4',
    Left5: 'govuk-!-margin-left-5',
    Left6: 'govuk-!-margin-left-6',
    Left7: 'govuk-!-margin-left-7',
    Left8: 'govuk-!-margin-left-8',
    Left9: 'govuk-!-margin-left-9',
  },

  /**
   * Responsive padding overrides (scale 0–9).
   *
   * Spacing scale: 0=0, 1=5px, 2=10px, 3=15px, 4=20px, 5=25px, 6=30px, 7=40px, 8=50px, 9=60px
   * (values 4–9 are smaller on mobile).
   *
   * @see https://design-system.service.gov.uk/styles/spacing/#spacing-override-classes
   */
  Padding: {
    All0: 'govuk-!-padding-0',
    All1: 'govuk-!-padding-1',
    All2: 'govuk-!-padding-2',
    All3: 'govuk-!-padding-3',
    All4: 'govuk-!-padding-4',
    All5: 'govuk-!-padding-5',
    All6: 'govuk-!-padding-6',
    All7: 'govuk-!-padding-7',
    All8: 'govuk-!-padding-8',
    All9: 'govuk-!-padding-9',

    Top0: 'govuk-!-padding-top-0',
    Top1: 'govuk-!-padding-top-1',
    Top2: 'govuk-!-padding-top-2',
    Top3: 'govuk-!-padding-top-3',
    Top4: 'govuk-!-padding-top-4',
    Top5: 'govuk-!-padding-top-5',
    Top6: 'govuk-!-padding-top-6',
    Top7: 'govuk-!-padding-top-7',
    Top8: 'govuk-!-padding-top-8',
    Top9: 'govuk-!-padding-top-9',

    Right0: 'govuk-!-padding-right-0',
    Right1: 'govuk-!-padding-right-1',
    Right2: 'govuk-!-padding-right-2',
    Right3: 'govuk-!-padding-right-3',
    Right4: 'govuk-!-padding-right-4',
    Right5: 'govuk-!-padding-right-5',
    Right6: 'govuk-!-padding-right-6',
    Right7: 'govuk-!-padding-right-7',
    Right8: 'govuk-!-padding-right-8',
    Right9: 'govuk-!-padding-right-9',

    Bottom0: 'govuk-!-padding-bottom-0',
    Bottom1: 'govuk-!-padding-bottom-1',
    Bottom2: 'govuk-!-padding-bottom-2',
    Bottom3: 'govuk-!-padding-bottom-3',
    Bottom4: 'govuk-!-padding-bottom-4',
    Bottom5: 'govuk-!-padding-bottom-5',
    Bottom6: 'govuk-!-padding-bottom-6',
    Bottom7: 'govuk-!-padding-bottom-7',
    Bottom8: 'govuk-!-padding-bottom-8',
    Bottom9: 'govuk-!-padding-bottom-9',

    Left0: 'govuk-!-padding-left-0',
    Left1: 'govuk-!-padding-left-1',
    Left2: 'govuk-!-padding-left-2',
    Left3: 'govuk-!-padding-left-3',
    Left4: 'govuk-!-padding-left-4',
    Left5: 'govuk-!-padding-left-5',
    Left6: 'govuk-!-padding-left-6',
    Left7: 'govuk-!-padding-left-7',
    Left8: 'govuk-!-padding-left-8',
    Left9: 'govuk-!-padding-left-9',
  },
}
