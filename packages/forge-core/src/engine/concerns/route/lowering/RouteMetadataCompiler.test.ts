/* eslint-disable no-new-func */
import AuthoredValueClassifier from '../../../chassis/compilation/analysis/shared/AuthoredValueClassifier'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import { FunctionType } from '../../../../authoring/types/enums'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import { getForgeRuntimeEvaluationDiagnostics } from '../../../errors/ForgeRuntimeEvaluationError'
import type { CompilationDependencies } from '../../../chassis/compilation/lowering/compilationDependencies.type'
import type { CompiledRouteMetadataContext } from '../../../chassis/contracts/compiled/compiledContexts.type'
import type { RouteMetadataModel } from '../contracts/routeMetadataModel.type'
import RouteMetadataCompiler from './RouteMetadataCompiler'

function createCtx(overrides: Partial<CompiledRouteMetadataContext> = {}): CompiledRouteMetadataContext {
  return {
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    request: {},
    workTasks: undefined,
    conditions: new FunctionRegistry(),
    ...overrides,
  }
}

const classify = (value: unknown) => new AuthoredValueClassifier().classify(value)

describe('RouteMetadataCompiler', () => {
  let compiler: RouteMetadataCompiler
  const dependencies: CompilationDependencies = {
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new RouteMetadataCompiler(dependencies)
  })

  describe('compile()', () => {
    it('should resolve static metadata for every node keyed by node id', async () => {
      // Arrange
      const stepId = ASTTestFactory.getId()
      const journeyId = ASTTestFactory.getId()
      const inputs: RouteMetadataModel[] = [
        {
          nodeId: stepId,
          title: classify('Step title'),
          description: classify('Step description'),
          metadata: classify({ navGroup: 'account' }),
        },
        { nodeId: journeyId, title: classify('Journey title') },
      ]
      const compiled = compiler.compile(inputs)

      // Act
      const result = await compiled(createCtx())

      // Assert
      expect(result[stepId]).toEqual({
        title: 'Step title',
        description: 'Step description',
        metadata: { navGroup: 'account' },
      })
      expect(result[journeyId]).toEqual({ title: 'Journey title' })
    })

    it('should omit description and metadata when the node provides none', async () => {
      // Arrange
      const nodeId = ASTTestFactory.getId()
      const compiled = compiler.compile([{ nodeId, title: classify('Only title') }])

      // Act
      const result = await compiled(createCtx())

      // Assert
      expect(result[nodeId]).toEqual({ title: 'Only title' })
    })

    it('should resolve a title expression against the request context', async () => {
      // Arrange
      const titleExpression = ASTTestFactory.reference(['data', 'pageTitle'])
      const stepNode = ASTTestFactory.step().withPath('/step').withProperty('title', titleExpression).build()
      const compiled = compiler.compile([{ nodeId: stepNode.id, title: classify(stepNode.properties.title) }])

      // Act
      const result = await compiled(createCtx({ data: { pageTitle: 'Resolved at request time' } }))

      // Assert
      expect(result[stepNode.id]).toEqual({ title: 'Resolved at request time' })
    })

    it('should throw a route-tree phase error when a title expression fails', () => {
      // Arrange
      const boomTitle = ASTTestFactory.functionExpression(FunctionType.GENERATOR, 'boom')
      const stepNode = ASTTestFactory.step().withProperty('title', boomTitle).build()
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        boom: {
          name: 'boom',
          isAsync: false,
          evaluate: () => {
            throw new Error('Title failed')
          },
        },
      })

      const throwingCompiler = new RouteMetadataCompiler({
        functionRegistry,
        componentRegistry: new ComponentRegistry(),
      })
      const compiled = throwingCompiler.compile([{ nodeId: stepNode.id, title: classify(stepNode.properties.title) }])

      // Act
      let thrown: unknown

      try {
        compiled(createCtx({ conditions: functionRegistry }))
      } catch (error) {
        thrown = error
      }

      // Assert
      if (!(thrown instanceof Error)) {
        throw new Error('Expected the failing title expression to throw')
      }

      expect(thrown.message).toBe('Failed to evaluate compiled Forge route-tree function: Title failed')
      expect(getForgeRuntimeEvaluationDiagnostics(thrown)).toMatchObject({ phase: 'route-tree' })
    })
  })

  describe('generateSource()', () => {
    it('should produce inspectable source that compiles to a function', () => {
      // Arrange
      const nodeId = ASTTestFactory.getId()

      // Act
      const source = compiler.generateSource([{ nodeId, title: classify('Step title') }])

      // Assert
      expect(source).toContain('routeMetadata')
      expect(source).not.toContain('routeMetadataEntry')
      expect(() => new Function('ctx', source)).not.toThrow()
    })
  })
})
