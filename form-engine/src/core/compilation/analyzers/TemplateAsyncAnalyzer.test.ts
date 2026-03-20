import { ASTNodeType } from '@form-engine/core/types/enums'
import { TemplateNode, TemplateValue } from '@form-engine/core/types/template.type'
import { ExpressionType, FunctionType } from '@form-engine/form/types/enums'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import TemplateAsyncAnalyzer from './TemplateAsyncAnalyzer'

function createFunctionTemplate(name: string, expressionType: FunctionType = FunctionType.CONDITION): TemplateNode {
  return {
    type: ASTNodeType.TEMPLATE,
    originalType: ASTNodeType.EXPRESSION,
    id: 'template:1',
    expressionType,
    properties: { name },
  }
}

function createEffectTemplate(name: string): TemplateNode {
  return createFunctionTemplate(name, FunctionType.EFFECT)
}

function createReferenceTemplate(): TemplateNode {
  return {
    type: ASTNodeType.TEMPLATE,
    originalType: ASTNodeType.EXPRESSION,
    id: 'template:2',
    expressionType: ExpressionType.REFERENCE,
    properties: { path: ['answers', 'fieldCode'] },
  }
}

function createIterateTemplate(yieldTemplate?: TemplateValue, predicateTemplate?: TemplateValue): TemplateNode {
  return {
    type: ASTNodeType.TEMPLATE,
    originalType: ASTNodeType.EXPRESSION,
    id: 'template:3',
    expressionType: ExpressionType.ITERATE,
    properties: {
      iterator: {
        yieldTemplate,
        predicateTemplate,
      },
    },
  }
}

function createSyncRegistry(...names: string[]): FunctionRegistry {
  const registry = new FunctionRegistry()

  const entries = Object.fromEntries(
    names.map(name => [name, { name, evaluate: (): undefined => undefined, isAsync: false }]),
  )

  registry.register(entries)

  return registry
}

function createAsyncRegistry(...names: string[]): FunctionRegistry {
  const registry = new FunctionRegistry()

  const entries = Object.fromEntries(
    names.map(name => [name, { name, evaluate: (): undefined => undefined, isAsync: true }]),
  )

  registry.register(entries)

  return registry
}

describe('TemplateAsyncAnalyzer', () => {
  describe('containsAsyncNodes()', () => {
    it('should return false for undefined', () => {
      // Arrange
      const registry = new FunctionRegistry()

      // Act
      const result = TemplateAsyncAnalyzer.containsAsyncNodes(undefined, registry)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false for primitive values', () => {
      // Arrange
      const registry = new FunctionRegistry()

      // Act / Assert
      expect(TemplateAsyncAnalyzer.containsAsyncNodes('hello', registry)).toBe(false)
      expect(TemplateAsyncAnalyzer.containsAsyncNodes(42, registry)).toBe(false)
      expect(TemplateAsyncAnalyzer.containsAsyncNodes(true, registry)).toBe(false)
      expect(TemplateAsyncAnalyzer.containsAsyncNodes(null, registry)).toBe(false)
    })

    it('should return false for a template with a sync function', () => {
      // Arrange
      const registry = createSyncRegistry('isEqual')
      const template = createFunctionTemplate('isEqual')

      // Act
      const result = TemplateAsyncAnalyzer.containsAsyncNodes(template, registry)

      // Assert
      expect(result).toBe(false)
    })

    it('should return true for a template with an async function', () => {
      // Arrange
      const registry = createAsyncRegistry('fetchData')
      const template = createFunctionTemplate('fetchData')

      // Act
      const result = TemplateAsyncAnalyzer.containsAsyncNodes(template, registry)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true for a template with an effect expression', () => {
      // Arrange
      const registry = new FunctionRegistry()
      const template = createEffectTemplate('saveRecord')

      // Act
      const result = TemplateAsyncAnalyzer.containsAsyncNodes(template, registry)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true when function is not found in registry', () => {
      // Arrange
      const registry = new FunctionRegistry()
      const template = createFunctionTemplate('unknownFunction')

      // Act
      const result = TemplateAsyncAnalyzer.containsAsyncNodes(template, registry)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false for non-function expressions', () => {
      // Arrange
      const registry = new FunctionRegistry()
      const template = createReferenceTemplate()

      // Act
      const result = TemplateAsyncAnalyzer.containsAsyncNodes(template, registry)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false for all function types when sync', () => {
      // Arrange
      const registry = createSyncRegistry('myCondition', 'myTransformer', 'myGenerator')

      // Act / Assert
      expect(
        TemplateAsyncAnalyzer.containsAsyncNodes(
          createFunctionTemplate('myCondition', FunctionType.CONDITION),
          registry,
        ),
      ).toBe(false)

      expect(
        TemplateAsyncAnalyzer.containsAsyncNodes(
          createFunctionTemplate('myTransformer', FunctionType.TRANSFORMER),
          registry,
        ),
      ).toBe(false)

      expect(
        TemplateAsyncAnalyzer.containsAsyncNodes(
          createFunctionTemplate('myGenerator', FunctionType.GENERATOR),
          registry,
        ),
      ).toBe(false)
    })

    it('should return true when async function is nested in a plain object', () => {
      // Arrange
      const registry = createAsyncRegistry('fetchData')
      const template = {
        field: createFunctionTemplate('fetchData'),
      }

      // Act
      const result = TemplateAsyncAnalyzer.containsAsyncNodes(template, registry)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true when async function is nested in an array', () => {
      // Arrange
      const registry = createAsyncRegistry('fetchData')
      const template = [createReferenceTemplate(), createFunctionTemplate('fetchData')]

      // Act
      const result = TemplateAsyncAnalyzer.containsAsyncNodes(template, registry)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true for nested iterate with async function in yield template', () => {
      // Arrange
      const registry = createAsyncRegistry('fetchData')
      const nestedIterate = createIterateTemplate(createFunctionTemplate('fetchData'))
      const template = createIterateTemplate(nestedIterate)

      // Act
      const result = TemplateAsyncAnalyzer.containsAsyncNodes(template, registry)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true for nested iterate with async function in predicate template', () => {
      // Arrange
      const registry = createAsyncRegistry('fetchData')
      const nestedIterate = createIterateTemplate(undefined, createFunctionTemplate('fetchData'))
      const template = createIterateTemplate(nestedIterate)

      // Act
      const result = TemplateAsyncAnalyzer.containsAsyncNodes(template, registry)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false for iterate with only sync functions', () => {
      // Arrange
      const registry = createSyncRegistry('isEqual')
      const template = createIterateTemplate(createFunctionTemplate('isEqual'))

      // Act
      const result = TemplateAsyncAnalyzer.containsAsyncNodes(template, registry)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false for iterate with no templates', () => {
      // Arrange
      const registry = new FunctionRegistry()
      const template = createIterateTemplate()

      // Act
      const result = TemplateAsyncAnalyzer.containsAsyncNodes(template, registry)

      // Assert
      expect(result).toBe(false)
    })

    it('should return true when function template has no name property', () => {
      // Arrange
      const registry = new FunctionRegistry()
      const template: TemplateNode = {
        type: ASTNodeType.TEMPLATE,
        originalType: ASTNodeType.EXPRESSION,
        id: 'template:1',
        expressionType: FunctionType.CONDITION,
        properties: {},
      }

      // Act
      const result = TemplateAsyncAnalyzer.containsAsyncNodes(template, registry)

      // Assert
      expect(result).toBe(true)
    })
  })
})
