# Form Engine with AST-Based Runtime

## Overview
This project is building a declarative, server-side form system that uses a two-stage AST
(Abstract Syntax Tree) approach to handle complex, multi-step government-style forms.
Think of it as a form engine that transforms JSON configuration into intelligent,
validated form flows with minimal runtime overhead.

## The Problem We're Solving
Building complex multi-step forms (like government assessments, applications, or wizards) typically involves:
- Tons of imperative validation logic scattered across controllers
- Complex conditional field dependencies that are hard to maintain
- Difficulty in versioning and migrating form data structures
- Performance issues with large, dynamic forms
- Repetitive code for common patterns (save draft, validation, navigation)

## The Solution: Two-Stage AST Processing
### Stage 1: Compilation (Build Time)
When a form definition (JSON) is loaded, we:
1. **Parse** the JSON into an Abstract Syntax Tree
2. **Analyze** dependencies between fields, creating a topologically-sorted dependency graph
3. **Generate** optimized lambda functions for each field's validation, visibility, and value calculation
4. **Prepare** the form for efficient runtime evaluation

This happens once when the form is loaded, not on every request.

### Stage 2: Evaluation (Runtime)
When a user interacts with the form, we:
1. **Provide context** to the pre-compiled AST (user answers, external data, request data)
2. **Evaluate** only what's needed using the generated lambda functions
3. **Calculate** field states, validation results, and navigation paths efficiently
4. **Return** server-rendered HTML with the appropriate form state

## Key Architecture Decisions

### Server-Side Rendering
This is a **server-rendered** form system, not a SPA. Each step is a full page load, with the server maintaining form state and handling all logic. This ensures:
- Accessibility by default
- Works without JavaScript
- Progressive enhancement possible
- Consistent validation between client and server

### Declarative Configuration
Forms are defined declaratively in TypeScript (compiling to JSON), not imperatively in code:

```typescript
// Instead of imperative validation logic scattered in controllers...
if (req.body.age < 18 && req.body.parentalConsent !== 'yes') {
  errors.push('Parental consent required')
}

// You declare the rule once with the field
field({
  code: 'parental_consent',
  dependent: when(Answer('age').match(Condition.LessThan(18))),
  validate: [
    validation({
      when: Self().not.match(Condition.Equals('yes')),
      message: 'Parental consent required for minors'
    })
  ]
})
```

### Dependency Graph Resolution
The AST automatically:
- Identifies all data dependencies between fields
- Topologically sorts them to resolve in the correct order
- Ensures circular dependencies are caught at compile time
- Optimizes evaluation to only recalculate what's changed

### Collections and Dynamic Content
The system handles dynamic, repeating sections through collection blocks that:
- Generate fields dynamically based on data arrays
- Maintain proper namespacing and validation per item
- Handle add/edit/delete operations declaratively
- Scale efficiently even with large collections

## Core Concepts

### Journey → Step → Block/Field Hierarchy
```
Journey (Complete multi-step flow)
├── Step (Individual page)
│   ├── Block (UI component)
│   ├── Field (Form input with validation)
│   └── CollectionBlock (Dynamic repeated sections)
└── Child Journey (Sub-flow within main journey)
```

### Reference System
A unified way to reference data throughout the form:
- `Self()` - Current field's value
- `Answer('field_name')` - Other field values
- `Data('source.path')` - External data loaded at step level
- `Item()` - Current item in a collection loop
- `Post()`, `Params()`, `Query()` - HTTP request data

### Validation as Data
Validation rules are data, not code, making them:
- Testable in isolation
- Reusable across fields
- Composable into complex rules
- Versionable with the form definition

## Benefits of This Approach

### Performance
- **Compile once, evaluate many**: Heavy lifting done at form load, not per request
- **Selective evaluation**: Only recalculate affected fields when data changes
- **Optimized dependency resolution**: No redundant calculations

### Maintainability
- **Single source of truth**: All form logic in one declarative structure
- **Clear data flow**: Dependencies are explicit and traceable
- **Versioning built-in**: Form definitions can be versioned and migrated

### Developer Experience
- **TypeScript-first**: Full type safety with generated types from definitions
- **Composable abstractions**: Reuse validation rules, conditions, and transformers
- **Predictable behavior**: Declarative approach reduces surprises

### Flexibility
- **Extensible**: Register custom validators, transformers, and blocks
- **Framework agnostic**: Can integrate with any Node.js server framework
- **Progressive enhancement**: Start server-only, add client features as needed

## Use Cases
This system is particularly well-suited for:
- Government forms and assessments
- Multi-step application processes
- Complex conditional wizards
- Forms requiring audit trails and versioning
- High-stakes forms where validation consistency is critical

## Technical Stack
- **Runtime**: Node.js with server-side rendering
- **Templates**: Nunjucks for HTML generation
- **Configuration**: TypeScript → JSON
- **State Management**: Server-side sessions/database
- **Validation**: AST-based evaluation engine

## The Vision
Build forms by describing *what* they should do, not *how* to do it. Let the AST handle
the complexity of dependency resolution, validation ordering, and state management.
Focus on the business logic, not the plumbing.
