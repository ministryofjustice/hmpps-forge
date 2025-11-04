# Creating Custom Components

## Overview

The form system allows you to create custom components that extend the available UI elements
beyond the built-in set. Custom components integrate seamlessly with the form engine's rendering system,
validation, and data binding. Components are typically wrappers around template
libraries (like Nunjucks with GOV.UK Frontend) that transform form configuration into HTML, though you can write
components using just HTML strings if you prefer.

## Creating Custom Components

### Basic Structure

Custom components are created using the `buildComponent` helper, which ensures proper typing,
registration, and integration with the form engine:

```typescript
import { buildComponent } from '@form-engine/helpers/createComponent'
import nunjucks from 'nunjucks'

export const myCustomComponent = buildComponent<MyComponentInterface>(
  'myComponentVariant',
  async (block) => {
    // Transform block data into template parameters
    const params = {
      id: block.id ?? block.code,
      name: block.code,
      value: block.value,
      // ... other transformations
    }

    // Render using your template engine
    return nunjucks.render('path/to/template.njk', { params })
  }
)
```

### Component Interface

Every component needs a TypeScript interface that extends either `BlockDefinition` or `FieldBlockDefinition`.
You can read up more on the distinction between these types in the `block-type-documentation.md`:

```typescript
import { FieldBlockDefinition, ConditionalString } from '@form-engine/types'

export interface MyCustomComponent extends FieldBlockDefinition {
  /** Component variant identifier */
  variant: 'myComponentVariant'

  /** Component-specific properties */
  label: ConditionalString
  placeholder?: ConditionalString
  maxLength?: ConditionalString
  // ... other properties
}
```

### The buildComponent Helper

The `buildComponent` helper takes two parameters:
1. **variant** (`string`): The unique identifier for your component that matches the `variant` field in the interface
2. **render** (`(block: T) => Promise<string>`): The async function that transforms block data and returns HTML

```typescript
buildComponent<T extends BlockDefinition>(
  variant: string,
  render: (block: EvaluatedBlock<T>) => Promise<string>,
)
```

## Component Types

### 1. Simple Block Components
Non-interactive UI elements that display content:

```typescript
import { BlockDefinition } from '@form-engine/types'
import { buildComponent } from '@form-engine/helpers/createComponent'

interface AlertBlock extends BlockDefinition {
  variant: 'alert'
  alertType: 'info' | 'warning' | 'error'
  title: string
  message: string
}

export const alertComponent = buildComponent<AlertBlock>('alert', async block => {
  return `
    <div class="alert alert--${block.alertType}" role="alert">
      <h2>${block.title}</h2>
      <p>${block.message}</p>
    </div>
  `
})
```

### 2. Field Components

Form inputs that handle user data and validation:

```typescript
import { FieldBlockDefinition, ConditionalString } from '@form-engine/types'
import { buildComponent } from '@form-engine/helpers/createComponent'
import nunjucks from 'nunjucks'

interface CustomInput extends FieldBlockDefinition {
  variant: 'customInput'
  label: ConditionalString
  hint?: ConditionalString
  placeholder?: ConditionalString
}

export const customInput = buildComponent<CustomInput>('customInput', async block => {
  const params = {
    id: block.id ?? block.code,
    name: block.code,
    value: block.value,
    label: block.label,
    placeholder: block.placeholder,
    errorMessage: block.errors?.length
      ? { text: block.errors[0].message }
      : undefined,
  }

  return nunjucks.render('components/custom-input/template.njk', { params })
})
```

## Real-World Examples

### GOV.UK Text Input Component

A complete example showing all common patterns:

```typescript
export interface GovUKTextInput extends FieldBlockDefinition {
  variant: 'govukTextInput'
  label: ConditionalString | {
    text?: ConditionalString
    html?: ConditionalString
    classes?: ConditionalString
    isPageHeading?: ConditionalBoolean
  }
  hint?: ConditionalString | {
    text?: ConditionalString
    html?: ConditionalString
    classes?: ConditionalString
  }
  prefix?: { text: ConditionalString }
  suffix?: { text: ConditionalString }
  inputmode?: ConditionalString
  spellcheck?: ConditionalBoolean
  autocomplete?: ConditionalString
  classes?: ConditionalString
  attributes?: Record<string, any>
}

export const govukTextInput = buildComponent<GovUKTextInput>('govukTextInput', async block => {
  const params = {
    id: block.id ?? block.code,
    name: block.code,
    type: 'text',
    value: block.value,
    label: typeof block.label === 'object' ? block.label : { text: block.label },
    hint: typeof block.hint === 'object' ? block.hint : { text: block.hint },
    errorMessage: block.errors?.length ? { text: block.errors[0].message } : undefined,
    prefix: block.prefix,
    suffix: block.suffix,
    inputmode: block.inputmode,
    spellcheck: block.spellcheck,
    autocomplete: block.autocomplete,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucks.render('govuk/components/input/template.njk', { params })
})
```

### Component with Complex Logic
Components can include complex transformation logic:

```typescript
export const govukCharacterCount = buildComponent<GovUKCharacterCount>('govukCharacterCount', async block => {
  const params = {
    id: block.id ?? block.code,
    name: block.code,
    rows: block.rows || '5', // Default value
    value: block.value,
    // Prioritize maxWords over maxLength
    maxlength: block.maxWords ? undefined : block.maxLength,
    maxwords: block.maxWords,
    threshold: block.threshold,
    label: typeof block.label === 'object' ? block.label : { text: block.label },
    hint: typeof block.hint === 'object' ? block.hint : { text: block.hint },
    errorMessage: block.errors?.length ? { text: block.errors[0].message } : undefined,
    // ... additional properties
  }

  return nunjucks.render('govuk/components/character-count/template.njk', { params })
})
```

### Component with Items/Options
Components that render lists of options:

```typescript
interface RadioOption {
  value: ConditionalString
  text?: ConditionalString
  html?: ConditionalString
  hint?: ConditionalString | HintObject
  checked?: ConditionalBoolean
  disabled?: ConditionalBoolean
  conditional?: BlockDefinition
}

interface RadioDivider {
  divider: ConditionalString
}

export interface GovUKRadioInput extends FieldBlockDefinition {
  variant: 'govukRadioInput'
  /*...params  */
  items: (RadioOption | RadioDivider)[]
}

export const govukRadioInput = buildComponent<GovUKRadioInput>('govukRadioInput', async block => {
  // Transform items with type narrowing
  const items = block.items.map(option => {
    if ('divider' in option) {
      return { divider: option.divider }
    }

    return {
      value: option.value,
      text: option.text,
      html: option.html,
      hint: typeof option.hint === 'object' ? option.hint : { text: option.hint },
      checked: block.value === option.value || option.checked,
      disabled: option.disabled,
      conditional: option.conditional,
    }
  })

  const params = {
    name: block.code,
    items,
    // ... other params
  }

  return nunjucks.render('govuk/components/radios/template.njk', { params })
})
```

## Data Transformation Patterns

### 1. Error Message Handling
Field components should handle validation errors, errors come in the form of
```typescript
{
  message: string;
  details?: Record<string, any>
}[]
```
where `message` is the validation error message, and `details` is an optional object that can be used to provide
additional information about an error to the component. Most GOVUK components will just render the first
error message in the array of validation errors.

```typescript
const errorMessage = block.errors?.length ? { text: block.errors[0].message } : undefined
```

### 3. ID and Name Handling
Ensure proper form field identification:

```typescript
const id = block.id ?? block.code  // Use custom ID or fall back to code
const name = block.code             // Name is always the code for data binding
```

### 4. Default Values
Provide sensible defaults for optional properties, if not adding defaults in the Nunjucks template.

```typescript
const rows = block.rows || '5'
const classes = block.classes || ''
const disabled = block.disabled ?? false
```

### 5. Conditional Properties
Handle properties that might affect others:

```typescript
// Example: maxWords takes precedence over maxLength
const params = {
  maxlength: block.maxWords ? undefined : block.maxLength,
  maxwords: block.maxWords,
  // ...
}
```

## Registration

Components must be registered with the FormEngine to be available for use in forms.
Registration typically happens during application initialization:

```typescript
import FormEngine from '@form-engine/core/FormEngine'

// Create the form engine instance
const formEngine = new FormEngine()

// Register a single component
formEngine.registerComponent(CustomTextInput)

// Register multiple components at once
formEngine.registerComponents([
  CustomTextInput,
  CustomRadioInput,
  CustomDatePicker
])
```

### Registration Notes
- Built-in components (GOV.UK Frontend) are registered automatically unless disabled via options
- Components are stored by their `variant` property in the ComponentRegistry
- Attempting to register a duplicate variant will throw a `RegistryDuplicateError`
- Invalid component specs will throw a `RegistryValidationError`

## Best Practices

### 1. Interface Design
Define clear, well-documented interfaces with JSDoc comments:

```typescript
export interface MyComponent extends FieldBlockDefinition {
  /** Component variant identifier */
  variant: 'myComponent'

  /**
   * The label for the component.
   * @example 'Enter your name'
   * @example { text: 'Full Name', classes: 'label--large' }
   */
  label: ConditionalString | LabelObject
}
```

### 2. Defensive Transformation
Always handle edge cases in data transformation:

### 3. Type Safety
Use proper TypeScript types throughout:

```typescript
// Use type narrowing for union types
function isRadioDivider(
  option: RadioOption | RadioDivider
): option is RadioDivider {
  return 'divider' in option
}

// Use generic constraints
export const buildComponent = <T extends BlockDefinition>(
  variant: string,
  render: (block: EvaluatedBlock<T>) => Promise<string>
) => { /* ... */ }
```

### 4. Separation of Concerns
Keep transformation logic separate from template rendering:

```typescript
// Good - clear separation
const transformLabel = (label: string | LabelObject): LabelObject => {
  return typeof label === 'object' ? label : { text: label }
}

const transformHint = (hint?: string | HintObject): HintObject | undefined => {
  if (typeof hint === 'object') return hint
  if (hint) return { text: hint }
  return undefined
}

export const myComponent = buildComponent<MyComponent>('myComponent', async block => {
  const params = {
    label: transformLabel(block.label),
    hint: transformHint(block.hint),
    // ...
  }

  return nunjucks.render('template.njk', { params })
})
```

### 5. Consistent Naming
Follow consistent naming patterns across components:

```typescript
// Component interfaces: PascalCase with component type
GovUKTextInput
GovUKCharacterCount
CustomDatePicker

// Component exports: camelCase
govukTextInput
govukCharacterCount
customDatePicker

// Variant names: camelCase matching the export
'govukTextInput'
'govukCharacterCount'
'customDatePicker'
```
