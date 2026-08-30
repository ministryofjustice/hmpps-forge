import { z } from 'zod'

import { Transformer } from '../../src/authoring'
import { component, type BlockDefinition, type FieldBlockDefinition, type ResolvableString } from '../../src/components'

// Dumb components for engine contract tests. They declare only the registry
// surface the engine reads (field, inputSchema, errorAnchor), so fixtures
// carry nothing but the behavior under test. The resolvable props (label,
// text) exist for suites that assert dynamic property resolution.

export interface TextField extends FieldBlockDefinition {
  /** Overrides the error anchor, mirroring components that render their own ids. */
  id?: ResolvableString
  /** A resolvable display prop, for tests that assert dynamic property resolution. */
  label?: ResolvableString
}

export const TextField = component<TextField>('testTextField', {
  field: true,
  inputSchema: z.string(),
  errorAnchor: props => props.id ?? props.code,
  render: props => `<field:${props.code}>`,
})

export type CheckboxField = FieldBlockDefinition

/** A `multiple` field: every submitted value is kept and normalized to an array. */
export const CheckboxField = component<CheckboxField>('testCheckboxField', {
  field: true,
  inputSchema: z.array(z.string()),
  multiple: true,
  render: props => `<field:${props.code}>`,
})

export interface StaticText extends BlockDefinition {
  /** A resolvable display prop, for tests that assert dynamic property resolution. */
  text?: ResolvableString
}

/** A non-field block, for tests that assert basic-block behavior. */
export const StaticText = component<StaticText>('testStaticText', {
  render: props => `<static>${props.text}</static>`,
})

export interface RadioItem {
  value: string
  text?: string
  /** A conditional-reveal block, like the radio inputs' nested reveals. */
  block?: BlockDefinition
}

export interface RadioField extends FieldBlockDefinition {
  items: RadioItem[]
}

/** A field whose items carry nested reveal blocks, like the radio inputs. */
export const RadioField = component<RadioField>('testRadioField', {
  field: true,
  inputSchema: z.string(),
  render: props => `<field:${props.code}>`,
})

export type DateField = FieldBlockDefinition

/** An object-schema field with a component-injected formatter, like the date inputs. */
export const DateField = component<DateField>('testDateField', {
  field: true,
  inputSchema: z.object({ year: z.string(), month: z.string(), day: z.string() }).strict(),
  prepare: props => ({
    ...props,
    formatters: [Transformer.Object.ToISO({ year: 'year', month: 'month', day: 'day' }), ...(props.formatters ?? [])],
  }),
  render: props => `<field:${props.code}>`,
})

export const contractComponents = [TextField, CheckboxField, StaticText, RadioField, DateField]
