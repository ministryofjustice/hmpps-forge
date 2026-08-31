import nunjucks from 'nunjucks'
import { z } from 'zod'
import { FunctionRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'

import { nunjucksComponent } from './nunjucksComponent'

describe('nunjucksComponent()', () => {
  describe('factory()', () => {
    it('should pass package dependencies alongside the Nunjucks environment', async () => {
      // Arrange
      const environment = new nunjucks.Environment()
      const Card = nunjucksComponent<{ title: string }, { prefix: string }>('card', {
        factory:
          ({ nunjucksEnv, prefix }) =>
          async props =>
            nunjucksEnv.renderString('<h1>{{ prefix }}: {{ title }}</h1>', { ...props, prefix }),
      })
      const harness = new FunctionRegistryTestHarness(Card, { nunjucksEnv: environment, prefix: 'Case' })

      // Act
      const output = await harness.render(Card({ title: 'Details' }))

      // Assert
      expect(output).toBe('<h1>Case: Details</h1>')
    })

    it('should preserve field metadata on the component declaration', () => {
      // Arrange
      const TextInput = nunjucksComponent<object>('textInput', {
        field: true,
        inputSchema: z.string(),
        multiple: true,
        errorAnchor: props => props.code,
        factory: () => () => '<input>',
      })

      // Act
      const block = TextInput({ code: 'name' })

      // Assert
      expect(TextInput.inputSchema?.safeParse('Ada').success).toBe(true)
      expect(TextInput.multiple).toBe(true)
      expect(TextInput.errorAnchor?.({ code: 'name' })).toBe('name')
      expect(block.variant).toBe('textInput')
    })
  })
})
