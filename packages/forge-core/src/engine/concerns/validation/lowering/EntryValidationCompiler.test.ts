import { beforeEach, describe, expect, it } from 'vitest'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import { ExpressionType, FunctionType, PredicateType } from '../../../../authoring/types/enums'
import { StepEntryValidationAST } from '../../../chassis/contracts/ast/structures.type'
import { ReferenceASTNode } from '../../../chassis/contracts/ast/expressions.type'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import type { CompilationDependencies } from '../../../chassis/compilation/lowering/compilationDependencies.type'
import type { ValidationModel } from '../contracts/validationModel.type'
import EntryValidationCompiler from './EntryValidationCompiler'
import type { CompiledValidationContext } from '../../../chassis/contracts/compiled/compiledContexts.type'
import { workTaskBuilders } from '../../../chassis/runtime/context/compiledEvaluationContext'

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
    workTasks: workTaskBuilders,
    conditions: new FunctionRegistry(),
    ...overrides,
  }
}

function entryModel(entries: StepEntryValidationAST[] | undefined): ValidationModel {
  return {
    label: undefined,
    hasValidation: false,
    fields: [],
    domainRules: undefined,
    entryValidation: entries ?? [],
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
      const fn = compiler.compileOnEntryValidation(entryModel(undefined))
      const groups = await fn(createCtx())

      // Assert
      expect(groups).toEqual([])
    })

    it('should collapse to a bare empty return when no entries are configured', () => {
      // Act
      const source = compiler.generateOnEntryValidationSource(entryModel(undefined))

      // Assert
      expect(source).toContain('return [];')
      expect(source).not.toContain('addGroup')
      expect(source).not.toContain('seen')
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
      const fn = localCompiler.compileOnEntryValidation(entryModel(entries))

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
      const fn = localCompiler.compileOnEntryValidation(entryModel(entries))

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

      const fn = compiler.compileOnEntryValidation(entryModel(entries))

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

      const fn = compiler.compileOnEntryValidation(entryModel(entries))

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

      const fn = compiler.compileOnEntryValidation(entryModel(entries))

      // Act
      const result = await fn!(createCtx({ data: { entryActive: false } }))

      // Assert
      expect(result).toEqual([])
    })
  })
})
