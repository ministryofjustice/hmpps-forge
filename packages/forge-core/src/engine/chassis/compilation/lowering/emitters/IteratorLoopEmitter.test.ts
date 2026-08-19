import { code } from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import type { CompilationDependencies } from '../compilationDependencies.type'
import ExpressionDispatcher from '../expressions/ExpressionDispatcher'
import { compileGeneratedFunction } from '../GeneratedFunctionCompiler'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import IteratorLoopEmitter from './IteratorLoopEmitter'

type CollectFunction = (ctx: { data: Record<string, unknown> }) => unknown[]

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

      // Act
      const results = await collect({ data: { members: [{ name: 'Ada' }, null, { name: 'Bea' }] } })

      // Assert
      expect(results).toEqual([{ name: 'Ada' }, { name: 'Bea' }])
    })

    it('should normalize object inputs into keyed entries', async () => {
      // Arrange
      const collect = compileCollector(ASTTestFactory.reference(['data', 'members']))

      // Act
      const results = await collect({ data: { members: { ada: { age: 36 }, bea: 'young' } } })

      // Assert
      expect(results).toEqual([
        { '@key': 'ada', age: 36 },
        { '@key': 'bea', '@value': 'young' },
      ])
    })

    it('should produce no iterations when the input is not a collection', async () => {
      // Arrange
      const collect = compileCollector(ASTTestFactory.reference(['data', 'members']))

      // Act
      const results = await collect({ data: { members: 42 } })

      // Assert
      expect(results).toEqual([])
    })
  })
})
