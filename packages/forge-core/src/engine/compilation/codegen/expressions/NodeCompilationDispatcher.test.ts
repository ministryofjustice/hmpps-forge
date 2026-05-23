import { FunctionType, PredicateType } from '../../../../authoring/types/enums'
import { ASTTestFactory } from '../../../../testing/ASTTestFactory'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import type { CompilationDependencies } from '../CompilationDependencies'
import NodeCompilationDispatcher from './NodeCompilationDispatcher'

describe('NodeCompilationDispatcher', () => {
  let compiler: NodeCompilationDispatcher
  const dependencies: CompilationDependencies = { functionRegistry: new FunctionRegistry() }

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new NodeCompilationDispatcher(dependencies)
  })

  describe('compileExpression()', () => {
    it('should avoid wrapping direct function expressions twice when diagnostics are already on the function call', () => {
      // Arrange
      const expression = ASTTestFactory.functionExpression(FunctionType.GENERATOR, 'buildCode')

      // Act
      const source = compiler.compileExpression(expression)

      // Assert
      expect(source).toContain('_forgeHelpers.evaluateFunction')
      expect(source).toContain('functionName: "buildCode"')
      expect(source).not.toContain('_forgeHelpers.evaluateTracked')
    })

    it('should keep tracking non-function expressions around their compiled body', () => {
      // Arrange
      const predicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'enabled']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isRequired'),
      })

      // Act
      const source = compiler.compileExpression(predicate)

      // Assert
      expect(source).toContain('_forgeHelpers.evaluateTracked')
      expect(source).toContain('_forgeHelpers.evaluateFunction')
    })
  })
})
