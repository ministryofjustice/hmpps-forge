import { beforeEach, describe, expect, it } from 'vitest'
import { ASTTestFactory } from '../../../compilation/ast/testing-helpers/ASTTestFactory'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { ExpressionType, FunctionType, PredicateType } from '../../../../authoring/types/enums'
import { StepEntryValidationAST } from '../../../contracts/ast/structures.type'
import { ReferenceASTNode } from '../../../contracts/ast/expressions.type'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'
import EntryValidationCompiler from './EntryValidationCompiler'
import type { CompiledValidationContext } from '../../../contracts/compiled/compiledContexts.type'
import WorkTaskFactory from '../../../runtime/evaluation/work/WorkTaskFactory'

function createReference(path: string[]): ReferenceASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.REFERENCE,
    id: ASTTestFactory.getId(),
    diagnostics: ASTTestFactory.diagnostics(),
    properties: { path },
  } as ReferenceASTNode
}

function createCtx(overrides: Partial<CompiledValidationContext> = {}): CompiledValidationContext {
  return {
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    request: {},
    workTasks: WorkTaskFactory,
    conditions: new FunctionRegistry(),
    ...overrides,
  }
}

describe('EntryValidationCompiler', () => {
  let compiler: EntryValidationCompiler
  const dependencies: CompilationDependencies = {
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }

  dependencies.functionRegistry.register({
    equals: { name: 'equals', isAsync: true, evaluate: () => undefined },
  })

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new EntryValidationCompiler(dependencies)
  })

  describe('compileOnEntryValidation()', () => {
    it('should return an empty group selector when no entries are configured', async () => {
      // Act
      const fn = compiler.compileOnEntryValidation(undefined)
      const groups = await fn(createCtx())

      // Assert
      expect(groups).toEqual([])
    })

    it('should collect groups for matching entries', async () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
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

      functionRegistry.register({
        equals: {
          name: 'equals',
          isAsync: false,
          evaluate: (value: unknown, expected: unknown) => value === expected,
        },
      })

      const localCompiler = new EntryValidationCompiler({
        functionRegistry,
        componentRegistry: new ComponentRegistry(),
      })
      const fn = localCompiler.compileOnEntryValidation(entries)

      // Act
      const result = await fn!(createCtx({ conditions: functionRegistry, data: { addressLoaded: true } }))

      // Assert
      expect(result).toEqual(['contact', 'address'])
    })

    it('should await async entry predicates', async () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const entries: StepEntryValidationAST[] = [
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

      functionRegistry.register({
        equals: {
          name: 'equals',
          isAsync: true,
          evaluate: async (value: unknown, expected: unknown) => value === expected,
        },
      })

      const localCompiler = new EntryValidationCompiler({
        functionRegistry,
        componentRegistry: new ComponentRegistry(),
      })
      const fn = localCompiler.compileOnEntryValidation(entries)

      // Act
      const result = await fn!(createCtx({ conditions: functionRegistry, data: { addressLoaded: true } }))

      // Assert
      expect(result).toEqual(['address'])
    })

    it('should deduplicate groups across matching entries', async () => {
      // Arrange
      const entries: StepEntryValidationAST[] = [
        { groups: ['contact'], when: true },
        { groups: ['contact', 'address'], when: true },
      ]

      const fn = compiler.compileOnEntryValidation(entries)

      // Act
      const result = await fn!(createCtx())

      // Assert
      expect(result).toEqual(['contact', 'address'])
    })

    it('should collect groups when a non-predicate reference resolves truthy', async () => {
      // Arrange
      const entries: StepEntryValidationAST[] = [
        { groups: ['address'], when: createReference(['data', 'entryActive']) },
      ]

      const fn = compiler.compileOnEntryValidation(entries)

      // Act
      const result = await fn!(createCtx({ data: { entryActive: true } }))

      // Assert
      expect(result).toEqual(['address'])
    })

    it('should not collect groups when a non-predicate reference resolves falsy', async () => {
      // Arrange
      const entries: StepEntryValidationAST[] = [
        { groups: ['address'], when: createReference(['data', 'entryActive']) },
      ]

      const fn = compiler.compileOnEntryValidation(entries)

      // Act
      const result = await fn!(createCtx({ data: { entryActive: false } }))

      // Assert
      expect(result).toEqual([])
    })
  })
})
