import DuplicateRouteError from './DuplicateRouteError'
import ForgeCompilationError from './ForgeCompilationError'
import ForgeConfigurationReferenceScopeError from './ForgeConfigurationReferenceScopeError'
import ForgeConfigurationSchemaError from './ForgeConfigurationSchemaError'
import ForgeConfigurationSerialisationError from './ForgeConfigurationSerialisationError'
import ForgeRuntimeEvaluationError from './ForgeRuntimeEvaluationError'
import InvalidNodeError from './InvalidNodeError'
import RegistryDuplicateError from './RegistryDuplicateError'
import RegistryValidationError from './RegistryValidationError'
import UnknownNodeTypeError from './UnknownNodeTypeError'
import UnregisteredComponentError from './UnregisteredComponentError'
import UnregisteredFunctionError from './UnregisteredFunctionError'

describe('formatDiagnosticStack', () => {
  describe('error constructors', () => {
    it('should include diagnostic context in the stack for all custom errors', () => {
      // Arrange
      const errors: readonly Error[] = [
        new DuplicateRouteError({ path: '/existing' }),
        new ForgeCompilationError({
          phase: 'render',
          nodeId: 'compile_ast:1',
          formattedPath: 'journey > step > blocks[0]',
          functionName: 'explode',
          functionType: 'FunctionType.Generator',
          cause: new Error('boom'),
        }),
        new ForgeConfigurationReferenceScopeError({
          path: ['steps', 0],
          formattedPath: 'journey > step',
          code: 'INVALID_SCOPE',
          message: 'Reference is out of scope',
        }),
        new ForgeConfigurationSchemaError({
          path: ['children', 0, 'code'],
          formattedPath: 'journey > children[0] > code',
          code: 'INVALID_SCHEMA',
          expected: 'string',
          message: 'Invalid field',
        }),
        new ForgeConfigurationSerialisationError({
          path: ['steps', 0],
          formattedPath: 'journey > step',
          type: 'function',
          code: 'NOT_SERIALISABLE',
        }),
        new ForgeRuntimeEvaluationError({
          phase: 'render',
          nodeId: 'compile_ast:1',
          formattedPath: 'journey > step > blocks[0]',
          functionName: 'explode',
          functionType: 'FunctionType.Generator',
          cause: new Error('boom'),
        }),
        new InvalidNodeError({
          message: 'Invalid node',
          path: ['steps', 0],
          expected: 'Step',
          actual: 'Block',
          code: 'INVALID_NODE',
          node: { type: 'block' },
        }),
        new RegistryDuplicateError({
          registryType: 'function',
          itemName: 'CurrentUser',
          message: 'Function already registered',
        }),
        new RegistryValidationError({
          registryType: 'component',
          itemName: 'summary-card',
          expected: 'render function',
          received: 'undefined',
          message: 'Invalid component',
        }),
        new UnknownNodeTypeError({
          nodeType: 'mystery',
          path: ['steps', 0],
          node: { type: 'mystery' },
          validTypes: ['Step', 'Block'],
        }),
        new UnregisteredComponentError({
          path: ['steps', 0, 'blocks', 0],
          formattedPath: 'journey > step > blocks[0]',
          variant: 'summary-card',
        }),
        new UnregisteredFunctionError({
          path: ['steps', 0, 'onAccess'],
          formattedPath: 'journey > step > onAccess',
          functionName: 'loadPlan',
          functionType: 'FunctionType.Effect',
        }),
      ]

      // Act
      const stacksStartWithDiagnostics = errors.map(error => error.stack?.startsWith(String(error)))

      // Assert
      expect(stacksStartWithDiagnostics).toEqual(errors.map(() => true))
    })
  })
})
