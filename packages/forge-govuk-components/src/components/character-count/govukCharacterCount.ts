import {
  ResolvableBoolean,
  ResolvableNumber,
  ResolvableString,
  FieldBlockDefinition,
  FieldBlockProps,
} from '@ministryofjustice/hmpps-forge/core/components'
import { buildNunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import { field as buildField } from '@ministryofjustice/hmpps-forge/core/authoring'
import { normaliseGovukErrorMessage, normaliseGovukTextParam } from '../../utils/govukParamNormalisers'

/**
 * Props for the GovUKCharacterCount component.
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
export interface GovUKCharacterCountProps extends FieldBlockProps {
  /**
   * The ID of the textarea. Defaults to the value of `code` if not provided.
   * @example 'feedback-textarea'
   */
  id?: ResolvableString

  /**
   * Optional number of textarea rows. Defaults to 5 rows if not specified.
   * Controls the initial height of the textarea.
   * @example 8 // Taller textarea
   * @example 3 // Shorter textarea
   */
  rows?: ResolvableNumber | ResolvableString

  /**
   * The maximum number of characters allowed.
   * If `maxWords` is provided, this option will be ignored.
   * Either `maxLength` or `maxWords` must be specified.
   * @example 200 // Allow up to 200 characters
   * @example 1000 // Allow up to 1000 characters
   */
  maxLength?: ResolvableNumber

  /**
   * The maximum number of words allowed.
   * If provided, this takes precedence over `maxLength`.
   * Either `maxLength` or `maxWords` must be specified.
   * @example 150 // Allow up to 150 words
   * @example 500 // Allow up to 500 words
   */
  maxWords?: ResolvableNumber

  /**
   * The percentage value of the limit at which the count message is displayed.
   * If set, the count message will be hidden until this threshold is reached.
   * @example '75' // Show count when 75% of limit is reached
   * @example '90' // Show count when 90% of limit is reached
   */
  threshold?: ResolvableString

  /**
   * The label used by the character count component.
   * Can be a simple string or a complex object with additional properties.
   * @example 'Describe the issue' // Simple string label
   * @example { text: 'Feedback', classes: 'govuk-label--l' } // Object with styling
   */
  label:
    | ResolvableString
    | {
        /** Text content of the label */
        text?: ResolvableString
        /** HTML content of the label (takes precedence over text) */
        html?: ResolvableString
        /** Additional CSS classes for the label */
        classes?: ResolvableString
        /** Whether to render the label as a page heading (wrapped in h1) */
        isPageHeading?: ResolvableBoolean
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
    | ResolvableString
    | {
        /** Unique ID for the hint (auto-generated if not provided) */
        id?: ResolvableString
        /** Text content of the hint */
        text?: ResolvableString
        /** HTML content of the hint (takes precedence over text) */
        html?: ResolvableString
        /** Additional CSS classes for the hint */
        classes?: ResolvableString
        /** Additional HTML attributes for the hint */
        attributes?: Record<string, any>
      }

  /** Additional options for the form group containing the character count component. */
  formGroup?: {
    /** Classes to add to the form group wrapper. */
    classes?: ResolvableString
    /** HTML attributes to add to the form group wrapper */
    attributes?: Record<string, any>
    /** Content to add before the textarea input */
    beforeInput?: {
      /** Text content to add before the textarea */
      text?: ResolvableString
      /** HTML content to add before the textarea (takes precedence over text) */
      html?: ResolvableString
    }
    /** Content to add after the textarea input (in addition to count message). */
    afterInput?: {
      /** Text content to add after the textarea */
      text?: ResolvableString
      /** HTML content to add after the textarea (takes precedence over text) */
      html?: ResolvableString
    }
  }

  /** Additional CSS classes to add to the textarea element */
  classes?: ResolvableString

  /** Additional HTML attributes (such as data attributes) to add to the textarea element. */
  attributes?: Record<string, any>

  /**
   * Optional field to enable or disable the `spellcheck` attribute on the textarea.
   * When not specified, browsers will use their default behavior.
   * @example true // Enable spellcheck
   * @example false // Disable spellcheck
   */
  spellcheck?: ResolvableBoolean

  /** Additional options for the count message displayed below the textarea. */
  countMessage?: {
    /** Additional CSS classes for the count message */
    classes?: ResolvableString
  }

  /**
   * Message made available to assistive technologies to describe that the component
   * accepts only a limited amount of content. Visible when JavaScript is unavailable.
   * The component will replace the `%{count}` placeholder with the maxLength or maxWords value.
   * @example 'You can enter up to %{count} characters'
   * @example 'Please limit your response to %{count} words'
   */
  textareaDescriptionText?: ResolvableString

  /**
   * Message displayed when the number of characters is under the configured maximum.
   * The component will replace the `%{count}` placeholder with the number of remaining characters.
   * Supports pluralization rules for different languages.
   * @example { one: 'You have %{count} character remaining', other: 'You have %{count} characters remaining' }
   */
  charactersUnderLimitText?: {
    /** Message when exactly 1 character remains */
    one?: ResolvableString
    /** Message when multiple characters remain */
    other?: ResolvableString
  }

  /**
   * Message displayed when the number of characters reaches the configured maximum.
   * This message is displayed visually and through assistive technologies.
   * @example 'You have reached the character limit'
   */
  charactersAtLimitText?: ResolvableString

  /**
   * Message displayed when the number of characters exceeds the configured maximum.
   * The component will replace the `%{count}` placeholder with the number of characters over the limit.
   * Supports pluralization rules for different languages.
   * @example { one: 'You are %{count} character over the limit', other: 'You are %{count} characters over the limit' }
   */
  charactersOverLimitText?: {
    /** Message when exactly 1 character over limit */
    one?: ResolvableString
    /** Message when multiple characters over limit */
    other?: ResolvableString
  }

  /**
   * Message displayed when the number of words is under the configured maximum.
   * The component will replace the `%{count}` placeholder with the number of remaining words.
   * Supports pluralization rules for different languages.
   * @example { one: 'You have %{count} word remaining', other: 'You have %{count} words remaining' }
   */
  wordsUnderLimitText?: {
    /** Message when exactly 1 word remains */
    one?: ResolvableString
    /** Message when multiple words remain */
    other?: ResolvableString
  }

  /**
   * Message displayed when the number of words reaches the configured maximum.
   * This message is displayed visually and through assistive technologies.
   * @example 'You have reached the word limit'
   */
  wordsAtLimitText?: ResolvableString

  /**
   * Message displayed when the number of words exceeds the configured maximum.
   * The component will replace the `%{count}` placeholder with the number of words over the limit.
   * Supports pluralization rules for different languages.
   * @example { one: 'You are %{count} word over the limit', other: 'You are %{count} words over the limit' }
   */
  wordsOverLimitText?: {
    /** Message when exactly 1 word over limit */
    one?: ResolvableString
    /** Message when multiple words over limit */
    other?: ResolvableString
  }
}

export const govukCharacterCount = buildNunjucksComponent<GovUKCharacterCount>(
  'govukCharacterCount',
  (block, nunjucksEnv) => {
    const id = block.id ?? block.code

    const params = {
      id,
      name: block.code,
      rows: block.rows || '5',
      value: block.value,
      maxlength: block.maxWords ? undefined : block.maxLength,
      maxwords: block.maxWords,
      threshold: block.threshold,
      label: normaliseGovukTextParam(block.label),
      hint: normaliseGovukTextParam(block.hint),
      errorMessage: normaliseGovukErrorMessage(block.errors),
      formGroup: block.formGroup,
      classes: block.classes,
      attributes: block.attributes,
      spellcheck: block.spellcheck,
      countMessage: block.countMessage,
      textareaDescriptionText: block.textareaDescriptionText,
      charactersUnderLimitText: block.charactersUnderLimitText,
      charactersAtLimitText: block.charactersAtLimitText,
      charactersOverLimitText: block.charactersOverLimitText,
      wordsUnderLimitText: block.wordsUnderLimitText,
      wordsAtLimitText: block.wordsAtLimitText,
      wordsOverLimitText: block.wordsOverLimitText,
    }

    return nunjucksEnv.render('govuk/components/character-count/template.njk', {
      params,
    })
  },
)

/**
 * GOV.UK Character Count Component
 *
 * Full interface including forge discriminator properties.
 * For most use cases, use `GovUKCharacterCountProps` type or the `GovUKCharacterCount()` wrapper function instead.
 */
export interface GovUKCharacterCount extends FieldBlockDefinition, GovUKCharacterCountProps {
  /** Component variant identifier */
  variant: 'govukCharacterCount'
}

/**
 * Creates a GOV.UK Character Count textarea field.
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
export function GovUKCharacterCount(props: GovUKCharacterCountProps): GovUKCharacterCount {
  return buildField<GovUKCharacterCount>({ ...props, variant: 'govukCharacterCount' })
}
