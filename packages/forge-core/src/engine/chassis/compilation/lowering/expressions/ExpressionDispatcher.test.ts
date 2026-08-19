import { FunctionType, PredicateType } from '../../../../../authoring/types/enums'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import type { CompilationDependencies } from '../compilationDependencies.type'
import SourceRenderer from '../codegen/rendering/SourceRenderer'
import ExpressionDispatcher from './ExpressionDispatcher'

describe('ExpressionDispatcher', () => {
  let compiler: ExpressionDispatcher
  const dependencies: CompilationDependencies = {
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }

  dependencies.functionRegistry.register({
    buildCode: { name: 'buildCode', isAsync: true, evaluate: () => undefined },
    isRequired: { name: 'isRequired', isAsync: true, evaluate: () => undefined },
  })

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new ExpressionDispatcher(dependencies)
  })

  describe('compileExpressionCode()', () => {
    it('should avoid wrapping direct function expressions twice when diagnostics are already on the function call', () => {
      // Arrange
      const expression = ASTTestFactory.functionExpression(FunctionType.GENERATOR, 'buildCode')

      // Act
      const source = new SourceRenderer().renderCode(compiler.compileExpressionCode(expression)).source

      // Assert
      expect(source).toContain('_forgeHelpers.evaluateFunction')
      expect(source).toContain('_forgeRuntimeDiagnostics, 0, "buildCode"')
      expect(source).not.toContain('"functionName"')
      expect(source).not.toContain('_forgeHelpers.evaluateTracked')
      expect(compiler.diagnosticCatalogue).toMatchObject([
        { functionName: 'buildCode', functionType: FunctionType.GENERATOR },
      ])
    })

    it('should keep tracking non-function expressions around their compiled body', () => {
      // Arrange
      const predicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'enabled']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isRequired'),
      })

      // Act
      const source = new SourceRenderer().renderCode(compiler.compileExpressionCode(predicate)).source

      // Assert
      expect(source).toContain('_forgeHelpers.evaluateTracked')
      expect(source).toContain('_forgeHelpers.evaluateFunction')
    })
  })
})
