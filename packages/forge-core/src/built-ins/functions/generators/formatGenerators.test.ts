import { FunctionType } from '../../../authoring/types/enums'
import { ResolvableValue } from '../../../authoring/types/expressions.type'
import { FORMAT_STRING_GENERATOR_NAME, FormatGenerators, formatGeneratorsRegistry } from './formatGenerators'
import { FunctionRegistryTestHarness } from '../../../testing/functions/FunctionRegistryTestHarness'
import { GeneratorBuilder } from '../../../authoring/builders/GeneratorBuilder'

describe('FormatGenerators', () => {
  const registry = formatGeneratorsRegistry.build()
  const harness = new FunctionRegistryTestHarness(formatGeneratorsRegistry)

  describe('FormatString', () => {
    it('should replace positional placeholders when replacements are provided', () => {
      // Arrange
      const template = 'Hello %1, welcome to %2'

      // Act
      const result = harness.evaluate(FormatGenerators.FormatString(template, 'Ada', 'Forge'))

      // Assert
      expect(result).toBe('Hello Ada, welcome to Forge')
    })

    it('should leave unmatched placeholders when no replacement exists', () => {
      // Arrange
      const template = '%1 %2 %10'

      // Act
      const result = harness.evaluate(FormatGenerators.FormatString(template, 'one', 'two'))

      // Assert
      expect(result).toBe('one two %10')
    })

    it('should substitute empty strings when replacements are undefined', () => {
      // Arrange
      const template = 'Goals (%1)'

      // Act
      const result = harness.evaluate(FormatGenerators.FormatString(template, undefined))

      // Assert
      expect(result).toBe('Goals ()')
    })

    it('should keep replacement text literal when it contains replacement tokens', () => {
      // Arrange
      const template = '%1 %2'

      // Act
      const result = harness.evaluate(FormatGenerators.FormatString(template, '$&', '%1'))

      // Assert
      expect(result).toBe('$& %1')
    })

    it('should reject non-string templates when evaluated', () => {
      // Arrange
      const template = 123 as unknown as string

      // Act / Assert
      expect(() => harness.evaluate(FormatGenerators.FormatString(template as unknown as string))).toThrow(TypeError)
    })

    it('should build correct generator expression', () => {
      // Arrange / Act
      const builder = FormatGenerators.FormatString('Hello %1', 'Ada') as GeneratorBuilder<ResolvableValue[]>

      // Assert
      expect(builder.expr).toEqual({
        type: FunctionType.GENERATOR,
        name: FORMAT_STRING_GENERATOR_NAME,
        arguments: ['Hello %1', 'Ada'],
      })
    })

    it('should mark FormatString as sync', () => {
      // Assert
      expect(registry[FORMAT_STRING_GENERATOR_NAME].isAsync).toBe(false)
    })
  })
})
