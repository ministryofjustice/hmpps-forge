import { describe, expect, it } from 'vitest'
import {
  readForgeDeveloperGuidePreviewSlots,
  renderForgeDeveloperGuideMarkdown,
} from './forgeDeveloperGuideMarkdown'

describe('forgeDeveloperGuideMarkdown', () => {
  describe('renderForgeDeveloperGuideMarkdown()', () => {
    it('should render both extensions when a page contains a preview and a playground', () => {
      // Arrange
      const markdown = `
:::preview
---
slot: address-lookup-initial
title: Before lookup
---
:::

:::playground
---
title: Branching
base: /assets/playground/branching/
entry: journey.ts
start: /branching/overview
---
journey.ts
:::
`

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)
      const previewSlots = readForgeDeveloperGuidePreviewSlots(markdown)

      // Assert
      expect(result).toContain('data-forge-slot="address-lookup-initial"')
      expect(result).toContain('<script type="application/json" data-playground>')
      expect(result).not.toContain('role="alert"')
      expect(previewSlots).toEqual(['address-lookup-initial'])
    })

    it('should render plain markdown with GOV.UK classes', () => {
      // Arrange
      const markdown = 'A paragraph with [a link](https://example.com).'

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)

      // Assert
      expect(result).toContain('<p class="govuk-body">')
      expect(result).toContain('class="govuk-link"')
    })

    it('should render a deep dive block when markdown contains frontmatter metadata', () => {
      // Arrange
      const markdown = `
Before.

:::deep-dive
---
title: How Forge chooses the frontier
description: The detailed path logic.
summary: Show details
---

The body can contain **markdown**.
:::

After.
`

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)

      // Assert
      expect(result).toContain('class="forge-deep-dive"')
      expect(result).toContain('How Forge chooses the frontier')
      expect(result).toContain('The detailed path logic.')
      expect(result).toContain('Show details')
      expect(result).toContain('<strong>markdown</strong>')
      expect(result).toContain('Before.')
      expect(result).toContain('After.')
    })

    it('should not close a four-colon block early when the body contains three-colon lines', () => {
      // Arrange
      const markdown = `
::::deep-dive
---
title: Nested containers
---

:::frame
---
title: Step one
---
The inner body.
:::

::::

After.
`

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)

      // Assert
      expect(result).toContain('class="forge-deep-dive"')
      expect(result).toContain('Nested containers')
      expect(result).toContain(':::frame')
      expect(result).toContain('Step one')
      expect(result).toContain('The inner body.')
      expect(result).not.toContain('::::deep-dive')
      expect(result).toContain('After.')
    })

    it('should render a frame-sequence when the block uses four-colon fences with nested frames', () => {
      // Arrange
      const markdown = `
Before.

::::frame-sequence
---
title: Journey lifecycle
---

:::frame
---
title: Validate submission
---
\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`
===
Each field's rules fire **in order**.
:::

:::frame
---
title: Persist answers
---
The answers reach the store.
:::

::::

After.
`

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)

      // Assert
      expect(result).toContain('class="forge-frame-sequence"')
      expect(result).toContain('Journey lifecycle')
      expect(result).toContain('Validate submission')
      expect(result).toContain('Persist answers')
      expect(result).toContain('class="forge-mermaid"')
      expect(result).toContain('flowchart LR')
      expect(result).toContain('<strong>in order</strong>')
      expect(result).toContain('Before.')
      expect(result).toContain('After.')
    })

    it('should render a three-colon block when the document also contains a four-colon block', () => {
      // Arrange
      const markdown = `
:::param
---
name: path
type: string
required: true
---
The journey's route path.
:::

::::deep-dive
---
title: The wider picture
---
Deep dive body.
::::
`

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)

      // Assert
      expect(result).toContain('<div class="forge-param" id="param-path">')
      expect(result).toContain("The journey's route path.")
      expect(result).toContain('class="forge-deep-dive"')
      expect(result).toContain('The wider picture')
      expect(result).toContain('Deep dive body.')
    })

    it('should pass an unclosed four-colon block through as plain markdown', () => {
      // Arrange
      const markdown = `
::::deep-dive
---
title: Never closed
---
Deep dive body.
`

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)

      // Assert
      expect(result).toContain('::::deep-dive')
      expect(result).toContain('title: Never closed')
      expect(result).not.toContain('forge-deep-dive')
    })

    it('should render a param block with its signature, tag, and body', () => {
      // Arrange
      const markdown = `
:::param
---
name: path
type: string
required: true
---
The journey's route path, such as \`'/travel-declaration'\`.
:::
`

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)

      // Assert
      expect(result).toContain('<div class="forge-param" id="param-path">')
      expect(result).toContain('<code class="forge-param__name">path</code>')
      expect(result).toContain('<code class="forge-param__type">: string</code>')
      expect(result).toContain('app-tag--red')
      expect(result).toContain('Required')
      expect(result).toContain('route path')
      expect(result).toContain("<code>'/travel-declaration'</code>")
    })

    it('should render an optional param with a grey tag when required is false', () => {
      // Arrange
      const markdown = `
:::param
---
name: steps
type: StepDefinition[]
required: false
---
The steps directly contained by the journey.
:::
`

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)

      // Assert
      expect(result).toContain('app-tag--grey')
      expect(result).toContain('Optional')
      expect(result).not.toContain('app-tag--red')
    })

    it('should escape HTML in param names and types', () => {
      // Arrange
      const markdown = `
:::param
---
name: definition
type: Omit<JourneyDefinition, 'type'>
required: true
---
An object describing the journey.
:::
`

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)

      // Assert
      expect(result).toContain('Omit&lt;JourneyDefinition, &#39;type&#39;&gt;')
      expect(result).not.toContain('Omit<JourneyDefinition')
    })

    it('should nest a param inside its parent when it declares one', () => {
      // Arrange
      const markdown = `
:::param
---
name: reachability
type: JourneyReachability
required: false
---
Journey-level resume behaviour.
:::

:::param
---
name: resumeWhen
parent: reachability
type: true | PredicateExpr
required: false
---
Activates resume behaviour.
:::
`

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)

      // Assert
      expect(result).toContain('<div class="forge-param" id="param-reachability">')
      expect(result).toContain(
        '<div class="forge-param forge-param--nested" id="param-reachability-resumeWhen">',
      )

      const parentIndex = result.indexOf('id="param-reachability"')
      const childIndex = result.indexOf('id="param-reachability-resumeWhen"')
      const parentClose = result.lastIndexOf('</div>')
      expect(childIndex).toBeGreaterThan(parentIndex)
      expect(parentClose).toBeGreaterThan(childIndex)
    })

    it('should throw when a param names a parent that does not exist', () => {
      // Arrange
      const markdown = `
:::param
---
name: resumeWhen
parent: reachability
type: true | PredicateExpr
required: false
---
Activates resume behaviour.
:::
`

      // Act & Assert
      expect(() => renderForgeDeveloperGuideMarkdown(markdown)).toThrow(
        ':::param "resumeWhen" names parent "reachability"',
      )
    })

    it('should throw when a param omits the required attribute', () => {
      // Arrange
      const markdown = `
:::param
---
name: path
type: string
---
The journey's route path.
:::
`

      // Act & Assert
      expect(() => renderForgeDeveloperGuideMarkdown(markdown)).toThrow(
        ':::param "path" must declare "required: true" or "required: false"',
      )
    })

    it('should pass an unregistered container through as plain markdown', () => {
      // Arrange
      const markdown = `
:::warning
---
title: Not a thing
---
Body.
:::
`

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)

      // Assert
      expect(result).toContain(':::warning')
      expect(result).not.toContain('forge-param')
      expect(result).not.toContain('forge-deep-dive')
    })

    it('should pass a param block without frontmatter through as plain markdown', () => {
      // Arrange
      const markdown = `
:::param
The journey's route path.
:::
`

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)

      // Assert
      expect(result).toContain(':::param')
      expect(result).not.toContain('forge-param')
    })

    it('should render markdown between and after param blocks', () => {
      // Arrange
      const markdown = `
#### Definition properties

:::param
---
name: path
type: string
required: true
---
The journey's route path.
:::

#### Returns

The journey definition.
`

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)

      // Assert
      expect(result).toContain('Definition properties')
      expect(result).toContain('class="forge-param"')
      expect(result).toContain('Returns')
      expect(result).toContain('The journey definition.')
    })
  })
})
