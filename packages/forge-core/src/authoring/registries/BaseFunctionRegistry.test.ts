import { z } from 'zod'
import ConditionRegistry from './ConditionRegistry'

describe('BaseFunctionRegistry', () => {
  let registry: ConditionRegistry

  beforeEach(() => {
    registry = new ConditionRegistry()
  })

  describe('parseArgs()', () => {
    it('should register under the factory name when a named const factory is passed alone', () => {
      // Arrange
      const isAdult = () => (value: any) => value >= 18

      // Act
      registry.register(isAdult)

      // Assert
      expect(Object.keys(registry.build())).toEqual(['isAdult'])
    })

    it('should register under an anonymous name when an inline arrow factory is passed alone', () => {
      // Arrange & Act
      registry.register(() => (value: any) => value === true)

      // Assert
      expect(Object.keys(registry.build())).toEqual(['__anon_0'])
    })

    it('should extract the factory name when an options object precedes a named factory', () => {
      // Arrange
      const isPositive = () => (value: any) => value > 0

      // Act
      registry.register({}, isPositive)

      // Assert
      expect(Object.keys(registry.build())).toEqual(['isPositive'])
    })

    it('should use an anonymous name when an options object precedes an inline arrow factory', () => {
      // Arrange & Act
      registry.register({}, () => (value: any) => value < 0)

      // Assert
      expect(Object.keys(registry.build())).toEqual(['__anon_0'])
    })

    it('should keep the explicit string name when one is given over the factory name', () => {
      // Arrange
      const isAdult = () => (value: any) => value >= 18

      // Act
      registry.register('IsOfAge', isAdult)

      // Assert
      expect(Object.keys(registry.build())).toEqual(['IsOfAge'])
    })

    it('should register when the factory is embedded in the options object', () => {
      // Arrange & Act
      registry.register('IsAdult', {
        factory: () => (value: any) => value >= 18,
      })

      // Assert
      const built = registry.build()
      expect(Object.keys(built)).toEqual(['IsAdult'])
      expect(built.IsAdult.evaluate(21)).toBe(true)
      expect(built.IsAdult.evaluate(3)).toBe(false)
    })

    it('should prefer the positional factory when both positional and embedded are given', () => {
      // Arrange
      const embedded = () => (_value: any) => false
      const positional = () => (_value: any) => true

      // Act
      registry.register('AlwaysTrue', { factory: embedded } as any, positional)

      // Assert
      expect(registry.build().AlwaysTrue.evaluate(0)).toBe(true)
    })

    it('should throw when a named registration supplies no factory at all', () => {
      // Arrange & Act
      const act = () => registry.register('Broken', {} as any)

      // Assert
      expect(act).toThrow(
        'The FunctionType.Condition registration "Broken" has no factory - pass one positionally or as options.factory',
      )
    })
  })

  describe('store()', () => {
    it('should compile schemas when registering a function', () => {
      // Arrange
      const inputSchema = z.object({ value: z.string() })
      const argumentsSchema = z.tuple([z.string()])
      const outputSchema = z.boolean()

      // Act
      registry.register('Compiled', {
        inputSchema,
        argumentsSchema,
        outputSchema,
        factory: () => () => true,
      })
      const registeredFunction = registry.build().Compiled

      // Assert
      expect(registeredFunction.inputSchema).not.toBe(inputSchema)
      expect(registeredFunction.argumentsSchema).not.toBe(argumentsSchema)
      expect(registeredFunction.outputSchema).not.toBe(outputSchema)
      expect(registeredFunction.inputSchema?.safeParse({ value: 'Ada' }).success).toBe(true)
    })

    it('should throw when the same explicit name is registered twice', () => {
      // Arrange
      registry.register('IsAdult', () => (value: any) => value >= 18)

      // Act
      const act = () => registry.register('IsAdult', () => (value: any) => value >= 21)

      // Assert
      expect(act).toThrow('A FunctionType.Condition is already registered under the name "IsAdult"')
    })

    it('should throw when two factories extract to the same name', () => {
      // Arrange
      const validate = () => (value: any) => value != null
      const validateAgain = () => (value: any) => value !== undefined
      Object.defineProperty(validateAgain, 'name', { value: 'validate' })
      registry.register(validate)

      // Act
      const act = () => registry.register(validateAgain)

      // Assert
      expect(act).toThrow('A FunctionType.Condition is already registered under the name "validate"')
    })
  })
})
