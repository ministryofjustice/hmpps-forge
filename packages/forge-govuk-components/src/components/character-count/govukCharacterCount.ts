import { z } from 'zod'
import { ResolvableFieldProps } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { normaliseGovukErrorMessage, normaliseGovukTextParam } from '../../utils/govukParamNormalisers'

/**
 * GOV.UK Character Count component.
 * Extends textarea with live feedback about remaining characters or words.
 *
 * @see https://design-system.service.gov.uk/components/character-count/
 * @example
 * ```typescript
 * GovUKCharacterCount({
 *   code: 'feedback',
 *   label: 'Provide your feedback',
 *   hint: 'Include as much detail as possible',
 *   maxLength: 500,
 * })
 * ```
 */
export type GovUKCharacterCount = ResolvableFieldProps<{
  /**
   * The ID of the textarea. Defaults to the value of `code` if not provided.
   * @example 'feedback-textarea'
   */
  id?: string

  /**
   * Optional number of textarea rows. Defaults to 5 rows if not specified.
   * Controls the initial height of the textarea.
   * @example 8 // Taller textarea
   * @example 3 // Shorter textarea
   */
  rows?: number | string

  /**
   * The maximum number of characters allowed.
   * If `maxWords` is provided, this option will be ignored.
   * Either `maxLength` or `maxWords` must be specified.
   * @example 200 // Allow up to 200 characters
   * @example 1000 // Allow up to 1000 characters
   */
  maxLength?: number

  /**
   * The maximum number of words allowed.
   * If provided, this takes precedence over `maxLength`.
   * Either `maxLength` or `maxWords` must be specified.
   * @example 150 // Allow up to 150 words
   * @example 500 // Allow up to 500 words
   */
  maxWords?: number

  /**
   * The percentage value of the limit at which the count message is displayed.
   * If set, the count message will be hidden until this threshold is reached.
   * @example '75' // Show count when 75% of limit is reached
   * @example '90' // Show count when 90% of limit is reached
   */
  threshold?: string

  /**
   * The label used by the character count component.
   * Can be a simple string or a complex object with additional properties.
   * @example 'Describe the issue' // Simple string label
   * @example { text: 'Feedback', classes: 'govuk-label--l' } // Object with styling
   */
  label:
    | string
    | {
        /** Text content of the label */
        text?: string
        /** HTML content of the label (takes precedence over text) */
        html?: string
        /** Additional CSS classes for the label */
        classes?: string
        /** Whether to render the label as a page heading (wrapped in h1) */
        isPageHeading?: boolean
        /** Additional HTML attributes for the label */
        attributes?: Record<string, any>
      }

  /**
   * Can be used to add a hint to the character count component.
   * Provides additional context or instructions for the user.
   * @example 'Include as much detail as possible' // Simple string hint
   * @example { html: 'See <a href="/help">guidance</a> for examples' } // Rich HTML hint
   */
  hint?:
    | string
    | {
        /** Unique ID for the hint (auto-generated if not provided) */
        id?: string
        /** Text content of the hint */
        text?: string
        /** HTML content of the hint (takes precedence over text) */
        html?: string
        /** Additional CSS classes for the hint */
        classes?: string
        /** Additional HTML attributes for the hint */
        attributes?: Record<string, any>
      }

  /** Additional options for the form group containing the character count component. */
  formGroup?: {
    /** Classes to add to the form group wrapper. */
    classes?: string
    /** HTML attributes to add to the form group wrapper */
    attributes?: Record<string, any>
    /** Content to add before the textarea input */
    beforeInput?: {
      /** Text content to add before the textarea */
      text?: string
      /** HTML content to add before the textarea (takes precedence over text) */
      html?: string
    }
    /** Content to add after the textarea input (in addition to count message). */
    afterInput?: {
      /** Text content to add after the textarea */
      text?: string
      /** HTML content to add after the textarea (takes precedence over text) */
      html?: string
    }
  }

  /** Additional CSS classes to add to the textarea element */
  classes?: string

  /** Additional HTML attributes (such as data attributes) to add to the textarea element. */
  attributes?: Record<string, any>

  /**
   * Optional field to enable or disable the `spellcheck` attribute on the textarea.
   * When not specified, browsers will use their default behavior.
   * @example true // Enable spellcheck
   * @example false // Disable spellcheck
   */
  spellcheck?: boolean

  /** Additional options for the count message displayed below the textarea. */
  countMessage?: {
    /** Additional CSS classes for the count message */
    classes?: string
  }

  /**
   * Message made available to assistive technologies to describe that the component
   * accepts only a limited amount of content. Visible when JavaScript is unavailable.
   * The component will replace the `%{count}` placeholder with the maxLength or maxWords value.
   * @example 'You can enter up to %{count} characters'
   * @example 'Please limit your response to %{count} words'
   */
  textareaDescriptionText?: string

  /**
   * Message displayed when the number of characters is under the configured maximum.
   * The component will replace the `%{count}` placeholder with the number of remaining characters.
   * Supports pluralization rules for different languages.
   * @example { one: 'You have %{count} character remaining', other: 'You have %{count} characters remaining' }
   */
  charactersUnderLimitText?: {
    /** Message when exactly 1 character remains */
    one?: string
    /** Message when multiple characters remain */
    other?: string
  }

  /**
   * Message displayed when the number of characters reaches the configured maximum.
   * This message is displayed visually and through assistive technologies.
   * @example 'You have reached the character limit'
   */
  charactersAtLimitText?: string

  /**
   * Message displayed when the number of characters exceeds the configured maximum.
   * The component will replace the `%{count}` placeholder with the number of characters over the limit.
   * Supports pluralization rules for different languages.
   * @example { one: 'You are %{count} character over the limit', other: 'You are %{count} characters over the limit' }
   */
  charactersOverLimitText?: {
    /** Message when exactly 1 character over limit */
    one?: string
    /** Message when multiple characters over limit */
    other?: string
  }

  /**
   * Message displayed when the number of words is under the configured maximum.
   * The component will replace the `%{count}` placeholder with the number of remaining words.
   * Supports pluralization rules for different languages.
   * @example { one: 'You have %{count} word remaining', other: 'You have %{count} words remaining' }
   */
  wordsUnderLimitText?: {
    /** Message when exactly 1 word remains */
    one?: string
    /** Message when multiple words remain */
    other?: string
  }

  /**
   * Message displayed when the number of words reaches the configured maximum.
   * This message is displayed visually and through assistive technologies.
   * @example 'You have reached the word limit'
   */
  wordsAtLimitText?: string

  /**
   * Message displayed when the number of words exceeds the configured maximum.
   * The component will replace the `%{count}` placeholder with the number of words over the limit.
   * Supports pluralization rules for different languages.
   * @example { one: 'You are %{count} word over the limit', other: 'You are %{count} words over the limit' }
   */
  wordsOverLimitText?: {
    /** Message when exactly 1 word over limit */
    one?: string
    /** Message when multiple words over limit */
    other?: string
  }
}>

/**
 * GOV.UK Character Count component.
 * Extends textarea with live feedback about remaining characters or words.
 *
 * @see https://design-system.service.gov.uk/components/character-count/
 * @example
 * ```typescript
 * GovUKCharacterCount({
 *   code: 'feedback',
 *   label: 'Provide your feedback',
 *   hint: 'Include as much detail as possible',
 *   maxLength: 500,
 * })
 * ```
 */
export const GovUKCharacterCount = nunjucksComponent<GovUKCharacterCount>('govukCharacterCount', {
  field: true,
  inputSchema: z.string(),
  // The rendered textarea's id matches the render params below, so error summary links land on it.
  errorAnchor: props => props.id ?? props.code,
  render: (props, nunjucksEnv) => {
    const id = props.id ?? props.code

    const params = {
      id,
      name: props.code,
      rows: props.rows || '5',
      value: props.value,
      maxlength: props.maxWords ? undefined : props.maxLength,
      maxwords: props.maxWords,
      threshold: props.threshold,
      label: normaliseGovukTextParam(props.label),
      hint: normaliseGovukTextParam(props.hint),
      errorMessage: normaliseGovukErrorMessage(props.errors),
      formGroup: props.formGroup,
      classes: props.classes,
      attributes: props.attributes,
      spellcheck: props.spellcheck,
      countMessage: props.countMessage,
      textareaDescriptionText: props.textareaDescriptionText,
      charactersUnderLimitText: props.charactersUnderLimitText,
      charactersAtLimitText: props.charactersAtLimitText,
      charactersOverLimitText: props.charactersOverLimitText,
      wordsUnderLimitText: props.wordsUnderLimitText,
      wordsAtLimitText: props.wordsAtLimitText,
      wordsOverLimitText: props.wordsOverLimitText,
    }

    return nunjucksEnv.render('govuk/components/character-count/template.njk', {
      params,
    })
  },
})
