import { code } from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import type { CompilationDependencies } from '../compilationDependencies.type'
import ExpressionDispatcher from '../expressions/ExpressionDispatcher'
import { compileGeneratedFunction } from '../GeneratedFunctionCompiler'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import IteratorLoopEmitter from './IteratorLoopEmitter'
import IteratorBudget from '../../../runtime/pipeline/IteratorBudget'

type CollectFunction = (ctx: { data: Record<string, unknown>; iteratorBudget?: IteratorBudget }) => unknown[]

describe('IteratorLoopEmitter', () => {
  let expr: ExpressionDispatcher
  let emitter: IteratorLoopEmitter
  const dependencies: CompilationDependencies = {
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()
    expr = new ExpressionDispatcher(dependencies)
    emitter = new IteratorLoopEmitter(expr)
  })

  function compileCollector(input: unknown): CollectFunction {
    return compileGeneratedFunction<CollectFunction>(expr, ['ctx'], () => {
      const generator = CodeGenerator.forFunction(['ctx'])
      const results = generator.const('results', code`[]`)

      emitter.compileLoop(input, generator, scope => {
        generator.statement(code`${results}.push(${scope.item})`)
      })
      generator.return(results)

      return generator
    })
  }

  describe('compileLoop()', () => {
    it('should iterate array inputs and skip empty items', async () => {
      // Arrange
      const collect = compileCollector(ASTTestFactory.reference(['data', 'members']))
      const ctx = {
        data: { members: [{ name: 'Ada' }, null, { name: 'Bea' }] },
        iteratorBudget: new IteratorBudget(),
      }

      // Act
      const results = await collect(ctx)

      // Assert
      expect(results).toEqual([{ name: 'Ada' }, { name: 'Bea' }])
    })

    it('should expose entry values as items when iterating object inputs', async () => {
      // Arrange
      const collect = compileCollector(ASTTestFactory.reference(['data', 'members']))
      const ctx = {
        data: { members: { ada: { age: 36 }, bea: 'young' } },
        iteratorBudget: new IteratorBudget(),
      }

      // Act
      const results = await collect(ctx)

      // Assert
      expect(results).toEqual([{ age: 36 }, 'young'])
    })

    it('should produce no iterations when the input is not a collection', async () => {
      // Arrange
      const collect = compileCollector(ASTTestFactory.reference(['data', 'members']))
      const ctx = {
        data: { members: 42 },
        iteratorBudget: new IteratorBudget(),
      }

      // Act
      const results = await collect(ctx)

      // Assert
      expect(results).toEqual([])
    })

    it('should stop iterating when the request budget is exhausted', () => {
      // Arrange
      const collect = compileCollector(ASTTestFactory.reference(['data', 'members']))
      const ctx = {
        data: { members: ['Ada', 'Bea', 'Cora'] },
        iteratorBudget: new IteratorBudget(2),
      }

      // Act
      const act = () => collect(ctx)

      // Assert
      expect(act).toThrow('Forge iterator evaluation exceeded the per-request limit of 2 iterations')
    })
  })
})
