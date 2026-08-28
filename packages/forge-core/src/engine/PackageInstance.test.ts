import { component } from '../components/component'
import { createForgePackage, field, journey, step, submit, validation, Self } from '../authoring/builders'
import { condition } from '../authoring/functions/condition'
import TransformerRegistry from '../authoring/registries/TransformerRegistry'
import { StructureType } from '../shared/taxonomy'
import type { JourneyDefinition } from '../authoring/types/structures.type'
import type { PredicateExpr } from '../authoring/types/expressions.type'
import type { BlockDefinition } from '../components/types/structures.type'
import type { CompiledPackage } from './chassis/contracts/plans/compilationArtefacts.type'
import CompilationPipeline from './chassis/compilation/pipeline/CompilationPipeline'
import ComponentRegistry from './chassis/registries/ComponentRegistry'
import FunctionRegistry from './chassis/registries/FunctionRegistry'
import ScopedComponentRegistry from './chassis/registries/ScopedComponentRegistry'
import ScopedFunctionRegistry from './chassis/registries/ScopedFunctionRegistry'
import ForgeTraceSinkDispatcher from './chassis/tracing/ForgeTraceSinkDispatcher'
import PackageInstance from './PackageInstance'

describe('PackageInstance', () => {
  describe('constructor()', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('should use global dependencies when package has no scoped registrations', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const componentRegistry = new ComponentRegistry()

      mockCompilation()

      // Act
      const instance = new PackageInstance(createForgePackage({ journey: createJourneyDefinition() }), {
        functionRegistry,
        componentRegistry,
        instrumentation: new ForgeTraceSinkDispatcher(),
      })

      // Assert
      expect(instance.getDependencies().functionRegistry).toBe(functionRegistry)
      expect(instance.getDependencies().componentRegistry).toBe(componentRegistry)
    })

    it('should scope package functions with provided dependencies', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const componentRegistry = new ComponentRegistry()

      functionRegistry.register({
        GlobalFunction: {
          name: 'GlobalFunction',
          evaluate: () => true,
          isAsync: false,
        },
      })
      mockCompilation()

      const packageFunctions = new TransformerRegistry<{ prefix: string }>()
      packageFunctions.register('WithPrefix', deps => (value: unknown) => `${deps.prefix}${String(value)}`)

      // Act
      const instance = new PackageInstance(
        createForgePackage({
          journey: createJourneyDefinition(),
          functions: packageFunctions,
        }),
        {
          functionRegistry,
          componentRegistry,
          functionDependencies: { prefix: 'case-' },
          instrumentation: new ForgeTraceSinkDispatcher(),
        },
      )

      // Assert
      const scopedFunctionRegistry = instance.getDependencies().functionRegistry

      expect(scopedFunctionRegistry).toBeInstanceOf(ScopedFunctionRegistry)
      expect(scopedFunctionRegistry.has('GlobalFunction')).toBe(true)
      expect(scopedFunctionRegistry.get('WithPrefix')?.evaluate('123')).toBe('case-123')
      expect(functionRegistry.has('WithPrefix')).toBe(false)
    })

    it('should scope package components without registering them globally', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const componentRegistry = new ComponentRegistry()
      const globalComponent = component<object>('global-component', { render: () => '<div>Global</div>' })
      const packageComponent = component<object>('package-component', { render: () => '<div>Package</div>' })

      componentRegistry.registerMany([globalComponent])
      mockCompilation()

      // Act
      const instance = new PackageInstance(
        createForgePackage({
          journey: createJourneyDefinition(),
          components: [packageComponent],
        }),
        { functionRegistry, componentRegistry, instrumentation: new ForgeTraceSinkDispatcher() },
      )

      // Assert
      const scopedComponentRegistry = instance.getDependencies().componentRegistry

      expect(scopedComponentRegistry).toBeInstanceOf(ScopedComponentRegistry)
      expect(scopedComponentRegistry.get('global-component')).toBe(globalComponent)
      expect(scopedComponentRegistry.get('package-component')).toBe(packageComponent)
      expect(componentRegistry.has('package-component')).toBe(false)
    })

    it('should scope an embedded component to the registering package', () => {
      // Arrange
      const componentRegistry = new ComponentRegistry()

      // Act
      const instance = new PackageInstance(
        createForgePackage({ journey: journeyWithBlocks([TestCard({ title: 'Hello' })]) }),
        {
          functionRegistry: new FunctionRegistry(),
          componentRegistry,
          instrumentation: new ForgeTraceSinkDispatcher(),
        },
      )

      // Assert
      expect(instance.getDependencies().componentRegistry.has('test-card')).toBe(true)
      expect(componentRegistry.has('test-card')).toBe(false)
    })

    it('should scope embedded function entries to the registering package', () => {
      // Arrange
      const Scoped = condition('Test.Scoped', { factory: () => () => true })
      const functionRegistry = new FunctionRegistry()
      const componentRegistry = new ComponentRegistry()

      componentRegistry.registerMany([testInput])

      // Act
      const instance = new PackageInstance(
        createForgePackage({ journey: journeyWithBlocks([fieldWithRule('crn', Self().match(Scoped()), 'Nope')]) }),
        { functionRegistry, componentRegistry, instrumentation: new ForgeTraceSinkDispatcher() },
      )

      // Assert
      expect(instance.getDependencies().functionRegistry.has('Test.Scoped')).toBe(true)
      expect(functionRegistry.has('Test.Scoped')).toBe(false)
    })

    it('should register an async embedded entry evaluator as isAsync', () => {
      // Arrange
      const IsOkAsync = condition('Test.IsOkAsync', { factory: () => async (value: unknown) => value === 'ok' })
      const functionRegistry = new FunctionRegistry()
      const componentRegistry = new ComponentRegistry()

      componentRegistry.registerMany([testInput])

      // Act
      const instance = new PackageInstance(
        createForgePackage({
          journey: journeyWithBlocks([fieldWithRule('status', Self().match(IsOkAsync()), 'Not ok')]),
        }),
        { functionRegistry, componentRegistry, instrumentation: new ForgeTraceSinkDispatcher() },
      )

      // Assert
      expect(instance.getDependencies().functionRegistry.get('Test.IsOkAsync')?.isAsync).toBe(true)
    })
  })
})

interface TestCardBlock {
  title: string
}

const TestCard = component<TestCardBlock>('test-card', { render: card => `<h2>${card.title}</h2>` })
const testInput = component<object>('test-input', { render: () => '<input />' })

function fieldWithRule(code: string, rule: PredicateExpr, message: string) {
  return field({
    variant: 'test-input',
    code,
    validWhen: [validation({ condition: rule, message })],
  })
}

function journeyWithBlocks(blocks: BlockDefinition[]) {
  return journey({
    code: 'scoping',
    title: 'Scoping Journey',
    path: '/scoping',
    reachability: { disableReachabilityChecks: true },
    steps: [
      step({
        code: 'step-one',
        title: 'Step One',
        path: '/step-one',
        onSubmission: [submit({ validate: true })],
        blocks,
      }),
    ],
  })
}

function mockCompilation(): void {
  vi.spyOn(CompilationPipeline.prototype, 'compile')
    .mockReturnValue(createCompilationResult())
}

function createJourneyDefinition(): JourneyDefinition {
  return {
    _forge: StructureType.JOURNEY,
    path: '/journey',
    code: 'journey',
    title: 'Journey',
    steps: [],
  }
}

function createCompilationResult(): CompiledPackage {
  return {
    journeyCode: 'journey',
    stepRouteIndex: new Map(),
    journeyRouteIndex: new Map(),
    steps: new Map(),
    journeys: new Map(),
  }
}
