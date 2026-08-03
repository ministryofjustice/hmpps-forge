import { expectTypeOf } from 'vitest'
import ConditionRegistry from './ConditionRegistry'
import GeneratorRegistry from './GeneratorRegistry'
import { Answer } from '../builders'
import type { Resolvable, ResolvableExpression } from '../types/expressions.type'

describe('ConditionRegistry', () => {
  describe('register()', () => {
    it('should widen annotated evaluator arguments to resolvable values on the handle', () => {
      // Arrange
      const registry = new ConditionRegistry()

      // Act
      const HasMinLength = registry.register('HasMinLength', () => (value: string, min: number) => value.length >= min)

      // Assert
      expectTypeOf<Parameters<typeof HasMinLength>>().toEqualTypeOf<[Resolvable<number>]>()
      expect(HasMinLength(5).name).toBe('HasMinLength')

      // A reference resolving to the argument at runtime is accepted
      HasMinLength(Answer('minimumLength'))

      // An expression declaring the matching resolved type is accepted
      HasMinLength(null as unknown as ResolvableExpression<number>)

      // @ts-expect-error - the evaluator declares a number, so a string is rejected
      HasMinLength('5')

      // @ts-expect-error - an expression declaring a string resolution cannot fill a number argument
      HasMinLength(null as unknown as ResolvableExpression<string>)
    })

    it('should accept a generator handle result in a resolvable argument slot', () => {
      // Arrange
      const registry = new ConditionRegistry()
      const generators = new GeneratorRegistry()
      const Today = generators.register('Today', () => () => '2026-08-03')

      // Act
      const IsBefore = registry.register('IsBefore', () => (value: string, threshold: string) => value < threshold)

      // Assert
      expect(IsBefore(Today()).name).toBe('IsBefore')
    })
  })
})
