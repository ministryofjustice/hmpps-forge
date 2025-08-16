# Block Types Documentation

## Overview

The form system uses a hierarchical block architecture to create flexible, declarative forms. 
All UI components are represented as 'blocks', with specialized types for different use cases. 
This document explains the four main block types and how they work together.

### Block Type Hierarchy

```
Block (Base)
├── Field (Form inputs)
├── CompositeBlock (Structural containers)
└── CollectionBlock (Dynamic templated content)
```

## 1. Block (Base Type)

The foundational building block for all interface components. Blocks are pure UI 
configuration objects that represent visual elements without any kind of form input.

### Structure
```typescript
interface BlockDefinition {
  type: 'block'    // Type identifier for supporting JSON parsing
  variant: string  // Component type (heading, content, etc.)
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
  summaryText: 'Help with nationality'
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
  validate?: CompiledRule[]           // Validation rules
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
  validate: [
    when(Self().not.match(Condition.IsRequired()))
      .then("Enter which other drug they've misused"),
    when(Self().not.match(Condition.HasMaxLength(characterLimits.c200)))
      .then(`Drug name must be ${characterLimits.c200} characters or less`,
    ),
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
    when(Self().not.match(Condition.IsRequired()))
      .then("Select if they've ever misused drugs")
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

#### `validate`
Validation rules define conditions that determine when a field's value is invalid and should 
display an error message to the user. Each rule consists of:

1. A predicate expression that evaluates to true or false
2. A corresponding error message to display when validation fails

These rules typically use negative logic (with .not.match()) to check for invalid conditions 
rather than valid ones. This approach allows the system to identify and report specific validation failures.

#### `dependent`
The dependent property determines whether a field should be included in form processing 
based on conditional logic. It serves two critical functions:

1. Validation Control: When a field's dependent condition evaluates to false,
   the field will not be validated, even if it has validation rules
3. Answer Management: When dependent is false, the field's value is automatically removed from form answers

Here's a section for CompositeBlock that follows the same style and structure:

## 3. CompositeBlock

CompositeBlocks are containers that group other blocks together for structural organization and visual layout. 
They provide a way to create reusable form sections and organize related fields into logical groups.

### Structure

```typescript
interface CompositeBlockDefinition extends BlockDefinition {
  blocks: BlockDefinition[]           // Child blocks contained within
  // ... variant-specific properties
}
```

### Examples

```typescript
// A fieldset grouping related personal information fields
const personalDetailsFieldset = block({
  variant: 'fieldset',
  legend: 'Personal Information',
  blocks: [
    field({
      variant: 'text',
      code: 'first_name',
      label: 'First Name',
      validate: [
        when(Self().not.match(Condition.IsRequired()))
          .then('First name is required')
      ]
    }),
    field({
      variant: 'text', 
      code: 'last_name',
      label: 'Last Name',
      validate: [
        when(Self().not.match(Condition.IsRequired()))
          .then('Last name is required')
      ]
    }),
    field({
      variant: 'email',
      code: 'email',
      label: 'Email Address',
      validate: [
        when(Self().not.match(Condition.IsRequired()))
          .then('Email is required'),
        when(Self().not.match(Condition.IsEmail()))
          .then('Enter a valid email address')
      ]
    })
  ]
})

// A conditional address section that appears based on other field values
const billingAddressSection = block({
  variant: 'fieldset',
  legend: 'Billing Address',
  display: when(Answer('same_as_delivery').not.match(Condition.MatchesValue(true))),
  blocks: [
    field({
      variant: 'text',
      code: 'billing_street',
      label: 'Street Address',
      dependent: when(Answer('same_as_delivery').not.match(Condition.MatchesValue(true))),
    }),
    field({
      variant: 'text',
      code: 'billing_city', 
      label: 'City',
      dependent: when(Answer('same_as_delivery').not.match(Condition.MatchesValue(true))),
    }),
    field({
      variant: 'text',
      code: 'billing_postcode',
      label: 'Postcode',
      dependent: when(Answer('same_as_delivery').not.match(Condition.MatchesValue(true))),
    })
  ]
})
```

### Concepts
#### `blocks`
An array of child blocks (Fields, Blocks, or other CompositeBlocks) that are contained within this composite block. 
These child blocks are rendered as a group together.

Here's a section for CollectionBlock following the same style:

## 4. CollectionBlock

CollectionBlocks iterate over arrays of data to generate repeated form sections dynamically. 
They use templates that are instantiated for each item in a collection, allowing forms to 
handle variable amounts of data efficiently.

### Structure

```typescript
interface CollectionBlockDefinition extends BlockDefinition {
  template: BlockDefinition[]             // Template blocks repeated for each item
  fallbackTemplate?: BlockDefinition      // Optional template when collection is empty
  collectionContext: CollectionOptions    // Configuration for data iteration
}

interface CollectionOptions {
  collection: ReferenceExpr | PipelineExpr | Array     // Data source to iterate over
  target?: ReferenceExpr | PipelineExpr | number       // Specific item/index
}
```

### Examples

```typescript
// A collection that creates address fields for each address in the user's saved addresses
const savedAddressesCollection = block({
  variant: 'collection-block-group',
  template: [
    field({
      variant: 'text',
      code: Format('address_%1_street', Item('id')),
      label: 'Street Address',
      value: Item('street'),  // Pre-populate from collection item
      validate: [
        when(Self().not.match(Condition.IsRequired()))
          .then('Street address is required')
      ]
    }),
    field({
      variant: 'text',
      code: Format('address_%1_city', Item('id')),
      label: 'City',
      value: Item('city')
    }),
    field({
      variant: 'select',
      code: Format('address_%1_country', Item('id')),
      label: 'Country',
      value: Item('country'),
      items: Data('countries')
    })
  ],
  collectionContext: {
    collection: Answer('user_addresses')  // Array of address objects
  }
})

// A collection with conditional fields based on item properties
const drugUsageCollection = block({
  variant: 'collection-block-group',
  template: [
    field({
      variant: 'radio',
      code: Format('drug_%1_last_used', Item('value')),
      label: Format('When did they last use %1?', Item('value')),
      items: [
        { label: 'Used in the last 6 months', value: 'LAST_SIX' },
        { label: 'Used more than 6 months ago', value: 'MORE_THAN_SIX' }
      ],
      validate: [
        when(Self().not.match(Condition.IsRequired()))
          .then('Select when they last used this drug')
      ]
    }),
  ],
  collectionContext: {
    collection: Answer('selected_drugs')  // Array of selected drug objects
  }
})
```

### Concepts

#### `template`
An array of blocks that serve as the blueprint for each item in the collection. 
The template is repeated once for every item, with `Item()` references resolved to the current item's data. 
Templates can contain any type of block: Fields, Blocks, or even nested CompositeBlocks.

#### `collectionContext`
Configuration that defines the data source and iteration behavior. The `collection` property 
specifies which array to iterate over, while the optional `target` property can focus on a specific item or index within the collection.

#### Dynamic Field Generation
When using fields in CollectionBlocks, it's worth giving them unique `code` attributes by combining the
`Format()` expression with an `Item()` reference. This ensures each repeated 
field has a distinct identifier while maintaining a predictable naming pattern.
