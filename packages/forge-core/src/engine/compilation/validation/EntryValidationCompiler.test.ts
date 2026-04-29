import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import { ExpressionType, FunctionType, PredicateType } from '../../../authoring/types/enums'
import FunctionRegistry from '../../registries/FunctionRegistry'
import { StepEntryValidationAST } from '../../types/structures.type'
import { ValidationContext } from './StepValidationCompiler'
import EntryValidationCompiler from './EntryValidationCompiler'

function createContext(functionRegistry: FunctionRegistry, data: Record<string, unknown> = {}): ValidationContext {
  return {
    answers: {},
    data,
    session: {},
    params: {},
    query: {},
    request: {},
    conditions: functionRegistry,
  }
}

describe('EntryValidationCompiler', () => {
  let compiler: EntryValidationCompiler
  let functionRegistry: FunctionRegistry

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new EntryValidationCompiler()
    functionRegistry = new FunctionRegistry()
    functionRegistry.register({
      equals: {
        name: 'equals',
        isAsync: false,
        evaluate: (value: unknown, expected: unknown) => value === expected,
      },
    })
  })

  describe('compile()', () => {
    it('should return undefined when no entries are configured', () => {
      // Arrange / Act
      const fn = compiler.compile(undefined, functionRegistry)

      // Assert
      expect(fn).toBeUndefined()
    })

    it('should collect groups for matching entries', () => {
      // Arrange
      const entries: StepEntryValidationAST[] = [
        { groups: ['contact'], when: true },
        {
          groups: ['address'],
          when: ASTTestFactory.predicate(PredicateType.TEST, {
            subject: ASTTestFactory.expression(ExpressionType.REFERENCE)
              .withProperty('path', ['data', 'addressLoaded'])
              .build(),
            condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'equals', [true]),
          }),
        },
      ]
      const fn = compiler.compile(entries, functionRegistry)

      // Act
      const result = fn!(createContext(functionRegistry, { addressLoaded: true }))

      // Assert
      expect(result).toEqual(['contact', 'address'])
    })

    it('should deduplicate groups across matching entries', () => {
      // Arrange
      const entries: StepEntryValidationAST[] = [
        { groups: ['contact'], when: true },
        { groups: ['contact', 'address'], when: true },
      ]
      const fn = compiler.compile(entries, functionRegistry)

      // Act
      const result = fn!(createContext(functionRegistry))

      // Assert
      expect(result).toEqual(['contact', 'address'])
    })
  })
})
