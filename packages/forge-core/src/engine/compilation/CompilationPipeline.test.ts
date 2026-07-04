import { field, journey, step } from '../../authoring'
import type { JourneyDefinition } from '../../authoring/types/structures.type'
import type { FieldBlockDefinition } from '../../components/types/structures.type'
import { buildComponent } from '../../components/utils/buildComponent'
import ComponentRegistry from '../registries/ComponentRegistry'
import FunctionRegistry from '../registries/FunctionRegistry'
import CompilationTracer from '../diagnostics/tracing/CompilationTracer'
import CompilationPipeline from './CompilationPipeline'

describe('CompilationPipeline', () => {
  describe('compile()', () => {
    it('should emit ordered completed phase spans when the tracer is enabled', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: true })
      const pipeline = new CompilationPipeline({
        functionRegistry: new FunctionRegistry(),
        componentRegistry: createComponentRegistry(),
        tracer,
      })

      // Act
      pipeline.compile(createValidJourney())

      // Assert
      const root = tracer.root

      expect(root?.children.map(child => child.kind)).toEqual([
        'compilation.ast',
        'compilation.semantic-analysis',
        'compilation.dependency-analysis',
        'compilation.lowering',
        'compilation.routes',
      ])
      root?.children.forEach(child => {
        expect(child.completed).toBe(true)
        expect(typeof child.durationMs).toBe('number')
      })
      expect(tracer.journeyCode).toBe('pipeline-journey')
    })

    it('should leave the semantic-analysis span incomplete and emit no later spans when validation fails', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: true })
      const pipeline = new CompilationPipeline({
        functionRegistry: new FunctionRegistry(),
        componentRegistry: new ComponentRegistry(),
        tracer,
      })

      // Act
      const compile = () => pipeline.compile(createInvalidJourney())

      // Assert
      expect(compile).toThrow()

      const root = tracer.root
      const semanticSpan = root?.children.find(child => child.kind === 'compilation.semantic-analysis')

      expect(root?.children.map(child => child.kind)).toEqual(['compilation.ast', 'compilation.semantic-analysis'])
      expect(semanticSpan?.completed).toBe(false)
    })

    it('should compile without recording spans when the tracer is disabled', () => {
      // Arrange
      const tracer = new CompilationTracer()
      const pipeline = new CompilationPipeline({
        functionRegistry: new FunctionRegistry(),
        componentRegistry: createComponentRegistry(),
        tracer,
      })

      // Act
      const result = pipeline.compile(createValidJourney())

      // Assert
      expect(tracer.root).toBeUndefined()
      expect(result.journeyCode).toBe('pipeline-journey')
      expect(result.steps).toBeInstanceOf(Map)
      expect(result.journeys).toBeInstanceOf(Map)
      expect(result.stepRouteIndex).toBeInstanceOf(Map)
      expect(result.journeyRouteIndex).toBeInstanceOf(Map)
    })
  })
})

function createComponentRegistry(): ComponentRegistry {
  const componentRegistry = new ComponentRegistry()

  componentRegistry.registerMany([buildComponent('PipelineInput', () => '<input />')])

  return componentRegistry
}

function createValidJourney(): JourneyDefinition {
  return journey({
    code: 'pipeline-journey',
    path: '/pipeline-journey',
    title: 'Pipeline Journey',
    steps: [
      step({
        path: '/name',
        title: 'Name',
        reachability: { entryWhen: true },
        blocks: [field<FieldBlockDefinition & { variant: string }>({ code: 'fullName', variant: 'PipelineInput' })],
      }),
    ],
  })
}

function createInvalidJourney(): JourneyDefinition {
  return journey({
    code: 'pipeline-journey',
    path: '/pipeline-journey',
    title: 'Pipeline Journey',
    steps: [
      step({
        path: '/name',
        title: 'Name',
        reachability: { entryWhen: true },
        blocks: [field<FieldBlockDefinition & { variant: string }>({ code: 'fullName', variant: 'UnregisteredInput' })],
      }),
    ],
  })
}
