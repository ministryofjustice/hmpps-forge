import { z } from 'zod'
import type { FunctionDefinitionObject } from '../../../authoring/types/functions.type'
import FunctionDefinitionCatalog from './FunctionDefinitionCatalog'

describe('FunctionDefinitionCatalog', () => {
  describe('register()', () => {
    it('should expose registered metadata without invoking or retaining the factory', () => {
      // Arrange
      const factory = vi.fn(() => () => true)
      const catalog = new FunctionDefinitionCatalog()

      // Act
      catalog.register({ Test: { name: 'Test', factory } })

      // Assert
      expect(catalog.get('Test')).toEqual({
        name: 'Test',
        inputSchema: undefined,
        argumentsSchema: undefined,
        outputSchema: undefined,
        _forge: undefined,
        multiple: undefined,
        errorAnchor: undefined,
        blocksSchema: undefined,
      })
      expect(factory).not.toHaveBeenCalled()
    })

    it('should retain a renderer block schema', () => {
      // Arrange
      const blocksSchema = z.array(z.object({ variant: z.string() }))
      const catalog = new FunctionDefinitionCatalog()

      // Act
      catalog.register({ Page: { name: 'Page', factory: () => () => '', blocksSchema } })

      // Assert
      expect(catalog.get('Page')?.blocksSchema).toBe(blocksSchema)
    })

    it('should reject duplicate definitions across builders', () => {
      // Arrange
      const catalog = new FunctionDefinitionCatalog()
      catalog.register({ Test: { name: 'Test', factory: () => () => true } })

      // Act
      const act = () => catalog.register({ Test: { name: 'Test', factory: () => () => false } })

      // Assert
      expect(act).toThrow('Function definition registration failed')
    })

    it('should reject a definition without a factory', () => {
      // Arrange
      const catalog = new FunctionDefinitionCatalog()
      const definitions = { Test: { name: 'Test' } } as unknown as FunctionDefinitionObject

      // Act
      const act = () => catalog.register(definitions)

      // Assert
      expect(act).toThrow('Function definition registration failed')
    })
  })
})
