import { DateGenerators, DateGeneratorsRegistry } from './dateGenerators'
import { FunctionType } from '../../form/types/enums'
import { GeneratorBuilder } from '../../form/builders/GeneratorBuilder'

describe('DateGenerators', () => {
  describe('Now', () => {
    const { evaluate } = DateGeneratorsRegistry.Now

    it('should return current date and time', () => {
      // Arrange
      const before = new Date()

      // Act
      const result = evaluate()

      // Assert
      const after = new Date()
      expect(result).toBeInstanceOf(Date)
      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it('should build correct generator expression', () => {
      // Arrange / Act
      const builder = DateGenerators.Now() as unknown as GeneratorBuilder<[]>

      // Assert
      expect(builder.expr).toEqual({
        type: FunctionType.GENERATOR,
        name: 'Now',
        arguments: [],
      })
    })
  })

  describe('Today', () => {
    const { evaluate } = DateGeneratorsRegistry.Today

    it('should return start of current day', () => {
      // Arrange
      const now = new Date()
      const expectedYear = now.getFullYear()
      const expectedMonth = now.getMonth()
      const expectedDate = now.getDate()

      // Act
      const result = evaluate()

      // Assert
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(expectedYear)
      expect(result.getMonth()).toBe(expectedMonth)
      expect(result.getDate()).toBe(expectedDate)
      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
      expect(result.getSeconds()).toBe(0)
      expect(result.getMilliseconds()).toBe(0)
    })

    it('should build correct generator expression', () => {
      // Arrange / Act
      const builder = DateGenerators.Today() as unknown as GeneratorBuilder<[]>

      // Assert
      expect(builder.expr).toEqual({
        type: FunctionType.GENERATOR,
        name: 'Today',
        arguments: [],
      })
    })
  })

  describe('Registry Metadata', () => {
    it('should mark Now as sync', () => {
      // Assert
      expect(DateGeneratorsRegistry.Now.isAsync).toBe(false)
    })

    it('should mark Today as sync', () => {
      // Assert
      expect(DateGeneratorsRegistry.Today.isAsync).toBe(false)
    })
  })
})
