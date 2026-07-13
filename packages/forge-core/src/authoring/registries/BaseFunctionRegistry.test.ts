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
  })

  describe('store()', () => {
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
