# Components

Components are renderers that transform block/field definitions into HTML.  For using blocks and fields in forms,
see [Blocks and Fields](./blocks-and-fields.md).

## What is a Component?

A component is a registered renderer identified by a `variant` string. When form-engine encounters a block with `variant: 'html'`, it looks up the `html` component and calls its render function with the evaluated block data.

### Import

```typescript
// Core components
import { HtmlBlock } from '@form-engine/registry/components/html'
import { TemplateWrapper } from '@form-engine/registry/components/templateWrapper'
import { CodeBlock } from '@form-engine/registry/components/codeBlock'
import { CollectionBlock } from '@form-engine/registry/components/collectionBlock'
```

---

## Component Architecture

Each component consists of:

1. **TypeScript interface** - defines the component's properties
2. **Render function** - transforms evaluated block data into HTML
3. **Registration** - exports using `buildComponent()` or `buildNunjucksComponent()`

---

## Custom Components

### Simple Block Component

Create custom components using `buildComponent()`:

```typescript
import { buildComponent } from '@form-engine/registry/utils/buildComponent'
import { BlockDefinition, ConditionalString } from '@form-engine/form/types/structures.type'

// 1. Define the interface
export interface MyAlertBox extends BlockDefinition {
  variant: 'myAlertBox'
  message: ConditionalString
  type?: 'info' | 'warning' | 'error' | 'success'
  title?: ConditionalString
}

// 2. Create the component with a render function
export const myAlertBox = buildComponent<MyAlertBox>('myAlertBox', async block => {
  const typeClass = `alert-box--${block.type ?? 'info'}`
  const titleHtml = block.title ? `<h3 class="alert-box__title">${block.title}</h3>` : ''

  return `
    <div class="alert-box ${typeClass}">
      ${titleHtml}
      <p class="alert-box__message">${block.message}</p>
    </div>
  `
})
```

### Using Nunjucks Templates

For more complex components, use `buildNunjucksComponent()`:

```typescript
import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import { BlockDefinition, ConditionalString, EvaluatedBlock } from '@form-engine/form/types/structures.type'

export interface MyCard extends BlockDefinition {
  variant: 'myCard'
  title: ConditionalString
  description?: ConditionalString
  href?: ConditionalString
}

async function cardRenderer(
  block: EvaluatedBlock<MyCard>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params = {
    title: block.title,
    description: block.description,
    href: block.href,
    hasLink: !!block.href,
  }

  return nunjucksEnv.render('components/my-card/template.njk', { params })
}

export const myCard = buildNunjucksComponent<MyCard>('myCard', cardRenderer)
```

### Field Components

Field components extend `FieldBlockDefinition` and have access to `value`, `errors`, and `code`:

```typescript
import { FieldBlockDefinition, ConditionalString, EvaluatedBlock } from '@form-engine/form/types/structures.type'

export interface MyStarRating extends FieldBlockDefinition {
  variant: 'myStarRating'
  label: ConditionalString
  maxStars?: number
}

async function starRatingRenderer(
  block: EvaluatedBlock<MyStarRating>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params = {
    name: block.code,           // Form field name
    id: block.code,
    value: block.value,         // Current value from answers
    errorMessage: block.errors?.length
      ? { text: block.errors[0].message }
      : undefined,
    label: block.label,
    maxStars: block.maxStars ?? 5,
  }

  return nunjucksEnv.render('components/star-rating/template.njk', { params })
}

export const myStarRating = buildNunjucksComponent<MyStarRating>('myStarRating', starRatingRenderer)
```

### Registering Components

Components must be registered with form-engine:

```typescript
import FormEngine from '@form-engine/core/FormEngine'
import { myAlertBox } from './components/myAlertBox'
import { myStarRating } from './components/myStarRating'

const formEngine = new FormEngine({ /* ... */ })
  .registerComponents({
    ...myAlertBox,
    ...myStarRating,
  })
```

---

## Best Practices

### Keep Templates Simple

Put complex logic in the renderer function, not the template:

```typescript
// DO: Transform data in the renderer
async function renderer(block, nunjucksEnv) {
  const params = {
    displayDate: formatDate(block.date),  // Transform here
    cssClass: block.type === 'urgent' ? 'alert--urgent' : 'alert--normal',
  }
  return nunjucksEnv.render('template.njk', { params })
}

// DON'T: Put logic in templates
// {% if params.type == 'urgent' %}...{% endif %}
```

### Use Type-Safe Interfaces

Define clear interfaces with JSDoc comments:

```typescript
export interface MyComponent extends BlockDefinition {
  variant: 'myComponent'

  /** The main content to display */
  content: ConditionalString

  /** Visual style variant */
  style?: 'default' | 'highlighted' | 'muted'
}
```

### Handle Edge Cases in Renderers

```typescript
async function renderer(block) {
  // Set defaults
  const style = block.style ?? 'default'

  // Handle missing optional values
  const titleHtml = block.title ? `<h3>${block.title}</h3>` : ''

  // Sanitize if needed
  const safeContent = escapeHtml(block.content)

  return `<div class="component component--${style}">${titleHtml}${safeContent}</div>`
}
```

---

## Core Components Registry

### HtmlBlock

Renders raw HTML content.

```typescript
import { HtmlBlock } from '@form-engine/registry/components/html'

block<HtmlBlock>({
  variant: 'html',
  content: '<p class="govuk-body">Your content here</p>',
  classes?: 'optional-wrapper-class',
  attributes?: { 'data-test': 'value' },
})
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `content` | `ConditionalString` | Yes | Raw HTML to render |
| `classes` | `ConditionalString` | No | CSS classes for wrapper div |
| `attributes` | `Record<string, any>` | No | HTML attributes for wrapper div |

### TemplateWrapper

Wraps child blocks in an HTML template with slots and values.

```typescript
import { TemplateWrapper } from '@form-engine/registry/components/templateWrapper'

block<TemplateWrapper>({
  variant: 'templateWrapper',
  template: `
    <section>
      <h2>{{title}}</h2>
      {{slot:content}}
    </section>
  `,
  values: {
    title: 'My Title',           // Replaces {{title}}
  },
  slots: {
    content: [                    // Replaces {{slot:content}}
      block<HtmlBlock>({ variant: 'html', content: '...' }),
    ],
  },
})
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `template` | `ConditionalString` | Yes | HTML template with `{{value}}` and `{{slot:name}}` markers |
| `values` | `Record<string, ConditionalString>` | No | Values to inject at `{{name}}` markers |
| `slots` | `Record<string, BlockDefinition[]>` | No | Blocks to render at `{{slot:name}}` markers |
| `classes` | `ConditionalString` | No | CSS classes for wrapper div |
| `attributes` | `Record<string, any>` | No | HTML attributes for wrapper div |

### CodeBlock

Displays syntax-highlighted code with server-side rendering.

```typescript
import { CodeBlock } from '@form-engine/registry/components/codeBlock'

block<CodeBlock>({
  variant: 'codeBlock',
  code: `const x = 1`,
  language?: 'typescript',
  title?: 'Example Code',
})
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `ConditionalString` | Yes | The code to display |
| `language` | `CodeLanguage` | No | Language for highlighting (default: `'typescript'`) |
| `title` | `ConditionalString` | No | Title displayed above the code block |
| `classes` | `ConditionalString` | No | Additional CSS classes |

**Supported languages:** `typescript`, `javascript`, `html`, `css`, `scss`, `json`, `bash`, `shell`, `yaml`, `markdown`, `plaintext`

### CollectionBlock

Renders repeated blocks from a collection.

```typescript
import { CollectionBlock } from '@form-engine/registry/components/collectionBlock'

block<CollectionBlock>({
  variant: 'collection-block',
  collection: Collection({
    collection: Data('items'),
    template: [ /* blocks using Item() */ ],
    fallback: [ /* blocks when empty */ ],
  }),
  classes?: 'wrapper-class',
  attributes?: { 'data-list': 'items' },
})
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `collection` | `CollectionExpr` | Yes | Collection expression with template and fallback |
| `classes` | `ConditionalString` | No | CSS classes for wrapper div |
| `attributes` | `Record<string, any>` | No | HTML attributes for wrapper div |

See [Logic and Expressions](./logic-and-expressions.md) for details on `Collection()` and `Item()`.
