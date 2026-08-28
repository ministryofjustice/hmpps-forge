import { z } from 'zod'
import { BlockDefinition, EvaluatedBlock, ResolvableFieldProps } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import {
  normaliseGovukErrorMessage,
  normaliseGovukFieldset,
  normaliseGovukTextParam,
  renderGovukBlocksToHtml,
  type GovukRenderedBlockContent,
} from '../../utils/govukParamNormalisers'

/**
 * GOV.UK Radio Input component.
 * Allows users to select a single option from a list of mutually exclusive choices.
 *
 * @see https://design-system.service.gov.uk/components/radios/
 * @example
 * ```typescript
 * GovUKRadioInput({
 *   code: 'contact_method',
 *   label: 'How would you like to be contacted?',
 *   items: [
 *     { value: 'email', text: 'Email' },
 *     { value: 'phone', text: 'Phone' },
 *     { value: 'text', text: 'Text message' },
 *   ],
 * })
 * ```
 */
export type GovUKRadioInput = ResolvableFieldProps<{
  /**
   * The label for the radio group.
   * When using fieldset, this becomes the legend text if no fieldset legend is specified.
   * @example 'How would you like to be contacted?'
   */
  label?: string

  /**
   * Can be used to add a fieldset to the radios component.
   * Provides semantic grouping and accessibility benefits for multiple related inputs.
   */
  fieldset?: {
    /**
     * Legend for the fieldset - describes the group of radio options.
     * If not provided, falls back to the `label` property.
     */
    legend?: {
      /** Text content of the legend */
      text?: string
      /** HTML content of the legend (takes precedence over text) */
      html?: string
      /** Additional CSS classes for the legend */
      classes?: string
      /** Whether to render the legend as a page heading (wrapped in h1) */
      isPageHeading?: boolean
    }
    /** Additional CSS classes for the fieldset wrapper */
    classes?: string
    /** HTML attributes to add to the fieldset */
    attributes?: Record<string, any>
    /** Element IDs to add to the fieldset's aria-describedby attribute */
    describedBy?: string
  }

  /**
   * Can be used to add a hint to the radios component.
   * Provides additional context or instructions for the radio group.
   *
   * @example 'Select all that apply' // Simple hint
   * @example { html: 'Choose the <strong>most appropriate</strong> option' } // Rich HTML hint
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

  /**
   * Additional options for the form group containing the radios component.
   * Allows customization of the wrapper element and additional content.
   */
  formGroup?: {
    /**
     * Classes to add to the form group wrapper.
     * Useful for custom styling or indicating error states.
     */
    classes?: string
    /** HTML attributes to add to the form group wrapper */
    attributes?: Record<string, any>
    /**
     * Content to add before all radio items within the radios component.
     * Useful for additional instructions or context.
     */
    beforeInputs?: {
      /** Text content to add before all radio items */
      text?: string
      /** HTML content to add before all radio items (takes precedence over text) */
      html?: string
      /** Additional CSS classes for the before inputs content */
      classes?: string
    }
    /**
     * Content to add after all radio items within the radios component.
     * Useful for additional information or related actions.
     */
    afterInputs?: {
      /** Text content to add after all radio items */
      text?: string
      /** HTML content to add after all radio items (takes precedence over text) */
      html?: string
      /** Additional CSS classes for the after inputs content */
      classes?: string
    }
  }

  /**
   * Optional prefix. This is used to prefix the `id` attribute for each radio input,
   * hint and error message, separated by `-`. Defaults to the `code` value.
   * @example 'contact-method' // Creates IDs like 'contact-method-email', 'contact-method-phone'
   */
  idPrefix?: string

  /**
   * Additional CSS classes to add to the radio container.
   * @example 'govuk-radios--inline' // Display radios horizontally
   * @example 'govuk-radios--small' // Smaller radio buttons
   */
  classes?: string

  /**
   * Additional HTML attributes (such as data attributes) to add to the radio input tag.
   * @example { 'data-module': 'govuk-radios' }
   */
  attributes?: Record<string, any>

  /**
   * The radio items within the radios component.
   * Can include both radio options and dividers for visual separation.
   * @example [
   *   { value: 'yes', text: 'Yes' },
   *   { value: 'no', text: 'No' },
   *   { divider: 'or' },
   *   { value: 'maybe', text: 'Not sure' }
   * ]
   */
  items: (GovUKRadioInputItem | GovUKRadioInputDivider)[]
}>

/**
 * Individual radio option within a radio group.
 * Represents a single selectable choice with optional conditional reveals.
 */
interface GovUKRadioInputItem {
  /**
   * Value for the radio input. This is submitted with the form data when selected.
   * @example 'email'
   * @example 'phone'
   */
  value: string

  /**
   * Text to use within the radio item label.
   * If `html` is provided, this will be ignored.
   * @example 'Email'
   */
  text?: string

  /**
   * HTML to use within the radio item label.
   * Takes precedence over `text` if both are provided.
   * @example 'Email <span class="govuk-caption-m">Fastest response</span>'
   */
  html?: string

  /**
   * Specific ID attribute for the radio item.
   * If omitted, then `idPrefix` string will be applied with the value.
   * @example 'contact-email'
   */
  id?: string

  /**
   * Can be used to add a hint to each radio item within the radios component.
   * Provides additional context for individual options.
   * @example 'We'll send updates to this email address'
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

  /**
   * Whether the radio should be checked when the page loads.
   * Takes precedence over the top-level `value` option.
   * @example true // Pre-select this option
   */
  checked?: boolean

  /**
   * If `true`, radio will be disabled and cannot be selected.
   * @example true // Disable this option
   */
  disabled?: boolean

  /**
   * Additional HTML attributes (such as data attributes) to add to the radio input tag.
   * @example { 'data-aria-controls': 'conditional-content' }
   */
  attributes?: Record<string, any>

  /**
   * Provide additional content to reveal when the radio is checked.
   * Useful for collecting additional information when specific options are selected.
   * @example someConditionalField // A field definition that appears when this radio is selected
   */
  block?: BlockDefinition | BlockDefinition[]

  /** Conditional visibility for this radio item */
  visibleWhen?: boolean
}

/**
 * Divider element to separate radio options visually.
 * Useful for grouping related options or providing "or" separators.
 */
interface GovUKRadioInputDivider {
  /**
   * Divider text to separate radio items.
   * @example 'or'
   * @example 'Alternative options'
   */
  divider: string

  /** Conditional visibility for this divider */
  visibleWhen?: boolean
}

/**
 * GOV.UK Radio Input component.
 * Allows users to select a single option from a list of mutually exclusive choices.
 *
 * @see https://design-system.service.gov.uk/components/radios/
 * @example
 * ```typescript
 * GovUKRadioInput({
 *   code: 'contact_method',
 *   label: 'How would you like to be contacted?',
 *   items: [
 *     { value: 'email', text: 'Email' },
 *     { value: 'phone', text: 'Phone' },
 *     { value: 'text', text: 'Text message' },
 *   ],
 * })
 * ```
 */
export const GovUKRadioInput = nunjucksComponent<GovUKRadioInput>('govukRadioInput', {
  field: true,
  inputSchema: z.string(),
  // The first rendered radio's id is the idPrefix, so error summary links land there.
  errorAnchor: props => props.idPrefix || props.code,
  render: (props, nunjucksEnv) => {
    const items = props.items
      .filter(option => option.visibleWhen !== false)
      .map(option => makeOption(option, props.value as string))

    const params = {
      fieldset: normaliseGovukFieldset(props.fieldset, props.label),
      idPrefix: props.idPrefix || props.code,
      name: props.code,
      value: props.value,
      formGroup: props.formGroup,
      hint: normaliseGovukTextParam(props.hint),
      items,
      classes: props.classes,
      attributes: props.attributes,
      errorMessage: normaliseGovukErrorMessage(props.errors),
    }

    return nunjucksEnv.render('govuk/components/radios/template.njk', {
      params,
    })
  },
})

const getConditionalContent = (block: GovukRenderedBlockContent) => {
  const html = renderGovukBlocksToHtml(block)

  if (html === undefined) {
    return undefined
  }

  return { html }
}

const makeOption = (option: EvaluatedBlock<GovUKRadioInputItem | GovUKRadioInputDivider>, checkedValue: string) => {
  if (isRadioDivider(option)) {
    return {
      divider: option.divider,
    }
  }

  return {
    value: option.value,
    text: option.text,
    html: option.html,
    id: option.id,
    hint: normaliseGovukTextParam(option.hint),
    checked: option.checked ?? checkedValue === option.value,
    conditional: getConditionalContent(option.block),
    disabled: option.disabled,
    attributes: option.attributes,
  }
}

// Narrow to Divider
function isRadioDivider(
  option: EvaluatedBlock<GovUKRadioInputItem | GovUKRadioInputDivider>,
): option is EvaluatedBlock<GovUKRadioInputDivider>
function isRadioDivider(option: any): option is GovUKRadioInputDivider {
  return option != null && typeof option === 'object' && 'divider' in option && !('value' in option) // prefer Divider if both accidentally exist
}
