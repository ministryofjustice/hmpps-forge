import { field, journey, step } from '../../../authoring'
import type { JourneyDefinition } from '../../../authoring/types/structures.type'
import type { FieldBlockDefinition } from '../../../components/types/structures.type'
import { buildComponent } from '../../../components/utils/buildComponent'
import ComponentRegistry from '../../registries/ComponentRegistry'
import FunctionRegistry from '../../registries/FunctionRegistry'
import ForgeTraceSinkDispatcher from '../../tracing/ForgeTraceSinkDispatcher'
import type { CompilationTraceEvent } from '../../contracts/compilation/trace.type'
import CompilationPipeline from './CompilationPipeline'

function createInstrumentation(): { instrumentation: ForgeTraceSinkDispatcher; events: CompilationTraceEvent[] } {
  const events: CompilationTraceEvent[] = []
  const instrumentation = new ForgeTraceSinkDispatcher({
    sinks: [{ onRequestTrace: () => undefined, onCompilationTrace: event => events.push(event) }],
  })

  return { instrumentation, events }
}

describe('CompilationPipeline', () => {
  describe('compile()', () => {
    it('should emit ordered completed phase spans when instrumentation is enabled', () => {
      // Arrange
      const { instrumentation, events } = createInstrumentation()
      const pipeline = new CompilationPipeline({
        functionRegistry: new FunctionRegistry(),
        componentRegistry: createComponentRegistry(),
        instrumentation,
      })

      // Act
      pipeline.compile(createValidJourney())

      // Assert
      expect(events).toHaveLength(1)

      const event = events[0]

      expect(event.trace.phases.map(phase => phase.phase)).toEqual([
        'dsl-validation',
        'ast',
        'semantic-analysis',
        'analysis',
        'lowering',
        'routes',
      ])
      event.trace.phases.forEach(phase => {
        expect(typeof phase.durationMs).toBe('number')
      })
      expect(event.trace.outcome).toBe('compiled')
      expect(event.journeyCode).toBe('pipeline-journey')
    })

    it('should stop at the semantic-analysis phase and emit an error trace when validation fails', () => {
      // Arrange
      const { instrumentation, events } = createInstrumentation()
      const pipeline = new CompilationPipeline({
        functionRegistry: new FunctionRegistry(),
        componentRegistry: new ComponentRegistry(),
        instrumentation,
      })

      // Act
      const compile = () => pipeline.compile(createInvalidJourney())

      // Assert
      expect(compile).toThrow()
      expect(events).toHaveLength(1)

      const event = events[0]

      expect(event.trace.outcome).toBe('error')
      expect(event.trace.phases.map(phase => phase.phase)).toEqual(['dsl-validation', 'ast', 'semantic-analysis'])
    })

    it('should compile without emitting traces when instrumentation is not provided', () => {
      // Arrange
      const pipeline = new CompilationPipeline({
        functionRegistry: new FunctionRegistry(),
        componentRegistry: createComponentRegistry(),
      })

      // Act
      const result = pipeline.compile(createValidJourney())

      // Assert
      expect(result.journeyCode).toBe('pipeline-journey')
      expect(result.steps).toBeInstanceOf(Map)
      expect(result.journeys).toBeInstanceOf(Map)
      expect(result.stepRouteIndex).toBeInstanceOf(Map)
      expect(result.journeyRouteIndex).toBeInstanceOf(Map)
    })

    it('should throw the original error rather than a work execution wrapper when a phase fails', () => {
      // Arrange
      const pipeline = new CompilationPipeline({
        functionRegistry: new FunctionRegistry(),
        componentRegistry: new ComponentRegistry(),
      })

      // Act
      const compile = () => pipeline.compile(createInvalidJourney())

      // Assert
      expect(compile).toThrow('AST semantic validation failed')
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
