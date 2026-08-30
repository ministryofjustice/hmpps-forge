import nunjucks from 'nunjucks'
import { z } from 'zod'
import { ComponentTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'

import { nunjucksComponent } from './nunjucksComponent'

describe('nunjucksComponent()', () => {
  describe('render()', () => {
    it('should adapt a props-first callback to a component function entry', async () => {
      // Arrange
      const environment = new nunjucks.Environment()
      const Card = nunjucksComponent<{ title: string }>('card', {
        render: (props, renderer) => renderer.renderString('<h1>{{ title }}</h1>', props),
      })
      const harness = new ComponentTestHarness(Card, { nunjucksEnv: environment })

      // Act
      const output = await harness.render(Card({ title: 'Details' }))

      // Assert
      expect(output).toBe('<h1>Details</h1>')
    })

    it('should preserve field metadata on the component declaration', () => {
      // Arrange
      const TextInput = nunjucksComponent<object>('textInput', {
        field: true,
        inputSchema: z.string(),
        multiple: true,
        errorAnchor: props => props.code,
        render: () => '<input>',
      })

      // Act
      const block = TextInput({ code: 'name' })

      // Assert
      expect(TextInput.inputSchema?.safeParse('Ada').success).toBe(true)
      expect(TextInput.multiple).toBe(true)
      expect(TextInput.errorAnchor?.({ code: 'name' })).toBe('name')
      expect(block.variant).toBe('textInput')
    })

    it('should reject a component that returns a non-string value at runtime', async () => {
      // Arrange
      const environment = new nunjucks.Environment()
      const Broken = nunjucksComponent<{ label: string }>('broken', {
        field: true,
        // @ts-expect-error Exercise the runtime contract for untyped JavaScript consumers.
        render: () => 123,
      })
      const harness = new ComponentTestHarness(Broken, { nunjucksEnv: environment })

      // Act
      const output = harness.render(Broken({ code: 'broken', label: 'Broken' })).withValue(undefined)

      // Assert
      await expect(output).rejects.toThrow('Nunjucks component "broken" must return an HTML string')
    })
  })
})
