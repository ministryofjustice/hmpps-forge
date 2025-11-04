# Block Types Documentation

## Overview

The form system uses a hierarchical block architecture to create flexible, declarative forms.
All UI components are represented as 'blocks', with specialized types for different use cases.
This document explains the four main block types and how they work together.

### Block Type Hierarchy

```
Block (Base)
└── Field (Form inputs)
```

## 1. Block (Base Type)

The foundational building block for all interface components. Blocks are pure UI
configuration objects that represent visual elements without any kind of form input.

### Structure
```typescript
interface BlockDefinition {
  type: StructureType.BLOCK    // Type identifier for supporting JSON parsing
  variant: string              // Component type (heading, content, etc.)
  // ... variant-specific properties
}
```

### Examples

```typescript
// Simple heading block
const checkAnswersBeforeSendingExamplehHeadingBlock = block({
  variant: 'heading',
  headingLevel: '1',
  text: 'Check your answers before sending your application',
})

// Expanding details block
const nationalityExampleDetailsBlock = block({
  variant: 'details',
  summaryText: 'Help with nationality',
  text: `We need to know your nationality so we can work out which
        elections you’re entitled to vote in. If you cannot provide your
        nationality, you’ll have to send copies of identity documents through the post.`
})

// Static HTML content
const legalNotice = block({
  variant: 'html',
  content: `
    <div>
      <p class='govuk-body'>By proceeding, you agree to our
         <a href="/terms">Terms of Service</a>
      </p>
    </div>
  `
})
```
### Concepts

#### `block`
All blocks are marked as `block` as their type. This is so they can easily be identified during JSON parsing.
#### `variant`
Every kind of block has it's own `variant`. These are used to distinguish the different types of Blocks
that are registered into the BlocksRegistry, for UI rendering. Some examples are `fieldset`, `radio`.

## 2. Field

Fields are specialized blocks that handle form inputs with data binding,
validation, and conditional display logic. They extend the base block functionality with form-specific capabilities.

### Structure

```typescript
interface FieldDefinition extends BlockDefinition {
  code: ConditionalString             // Data binding key
  value?: ConditionalString           // Default value
  validate?: ValidationExpr[]         // Validation rules
  dependent?: CompiledRule            // Conditional display/validation rule
  // ... variant-specific properties
}
```

### Examples
```typescript
// A conditional text input field
// This field has two validation rules;
// 1. If no value is entered, then validation error with "Enter which other drug they've misused"
// 2. If value is over max length of 200 characters, then validation
//    error with "Enter which other drug they've misused"
//
// This field has a dependent rule;
// 1. If field 'select_misused_drugs' contains value `OTHER_DRUG`
const otherDrugNameField: TextField = field({
  variant: 'text',
  code: 'other_drug',
  label: {
    text: 'What other drugs have been misused?',
    classes: GovUKClasses.visuallyHidden,
  },
  formatters: [ Transformers.String.Trim() ],
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: "Enter which other drug they've misused"
    }),
    validation({
      when: Self().not.match(Condition.HasMaxLength(characterLimits.c200)),
      message: `Drug name must be ${characterLimits.c200} characters or less`
    }),
  ],
  dependent: when(Answer('select_misused_drugs').match(Condition.Contains('OTHER_DRUG'))),
})

// A radio input field that is always shown (no dependent)
// This field has a single validation rule;
// 1. If no value is entered, then validation error with "Select if they've ever misused drugs"
const drugUse: RadioField = field({
  variant: 'radio',
  code: 'drug_use',
  hint: 'This includes illegal and prescription drugs.',
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: "Select if they've ever misused drugs"
    })
  ],
  items: [
    { value: 'YES', label: 'Yes' },
    { value: 'NO', label: 'No' },
  ],
})
```
### Concepts

#### `code`
The unique identifier that determines where the field's value is stored and retrieved. When rendered as HTML,
the code becomes the field's name attribute, making it the key used to access the field's
value in form submissions (POST data) and stored answers.

#### `formatters`
Formatters take an array of Transformers to apply to the value of a field on submission. These are
mainly used to trim spaces off text (`Transformers.String.Trim()`), convert to Int (`Transformers.String.ToInt`) etc.
These are applied in the order of the array.

#### `validate`
Validation rules define conditions that determine when a field's value is invalid and should
display an error message to the user. Each rule is a `ValidationExpr` with:

1. `when: PredicateExpr` - A predicate expression that when true triggers validation failure
2. `message: string` - Error message to display when validation fails
3. `submissionOnly?: boolean` - If true, only checked at submission time, not during journey traversal
4. `details?: Record<string, string>` - Details to include about the error, can be
   used for highlighting severity or specific sub-field in a composite component that failed validation.

These rules typically use negative logic (with .not.match()) to check for invalid conditions
rather than valid ones. This approach allows the system to identify and report specific validation failures.

#### `dependent`
The dependent property determines whether a field should be included in form processing
based on conditional logic. It serves two critical functions:

1. Validation Control: When a field's dependent condition evaluates to false,
   the field will not be validated, even if it has validation rules
2. Answer Management: When dependent is false, the field's value is mark for removal
