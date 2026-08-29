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
import ForgeTraceSinkDispatcher from './chassis/tracing/ForgeTraceSinkDispatcher'
import PackageInstance from './PackageInstance'

describe('PackageInstance', () => {
  describe('constructor()', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('should create empty registries when the package has no registrations', () => {
      // Arrange
      mockCompilation()

      // Act
      const instance = new PackageInstance(createForgePackage({ journey: createJourneyDefinition() }), {
        instrumentation: new ForgeTraceSinkDispatcher(),
      })

      // Assert
      expect(instance.getDependencies().functionRegistry).toBeInstanceOf(FunctionRegistry)
      expect(instance.getDependencies().functionRegistry.size()).toBe(0)
      expect(instance.getDependencies().componentRegistry).toBeInstanceOf(ComponentRegistry)
      expect(instance.getDependencies().componentRegistry.size()).toBe(0)
    })

    it('should build package functions with provided dependencies', () => {
      // Arrange
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
          functionDependencies: { prefix: 'case-' },
          instrumentation: new ForgeTraceSinkDispatcher(),
        },
      )

      // Assert
      const functionRegistry = instance.getDependencies().functionRegistry

      expect(functionRegistry).toBeInstanceOf(FunctionRegistry)
      expect(functionRegistry.get('WithPrefix')?.evaluate('123')).toBe('case-123')
    })

    it('should register package components', () => {
      // Arrange
      const packageComponent = component<object>('package-component', { render: () => '<div>Package</div>' })

      mockCompilation()

      // Act
      const instance = new PackageInstance(
        createForgePackage({
          journey: createJourneyDefinition(),
          components: [packageComponent],
        }),
        { instrumentation: new ForgeTraceSinkDispatcher() },
      )

      // Assert
      const componentRegistry = instance.getDependencies().componentRegistry

      expect(componentRegistry).toBeInstanceOf(ComponentRegistry)
      expect(componentRegistry.get('package-component')).toBe(packageComponent)
    })

    it('should register an embedded component', () => {
      // Arrange
      // Act
      const instance = new PackageInstance(
        createForgePackage({ journey: journeyWithBlocks([TestCard({ title: 'Hello' })]) }),
        { instrumentation: new ForgeTraceSinkDispatcher() },
      )

      // Assert
      expect(instance.getDependencies().componentRegistry.has('test-card')).toBe(true)
    })

    it('should register an embedded function entry', () => {
      // Arrange
      const Scoped = condition('Test.Scoped', { factory: () => () => true })

      // Act
      const instance = new PackageInstance(
        createForgePackage({
          journey: journeyWithBlocks([fieldWithRule('crn', Self().match(Scoped()), 'Nope')]),
          components: [testInput],
        }),
        { instrumentation: new ForgeTraceSinkDispatcher() },
      )

      // Assert
      expect(instance.getDependencies().functionRegistry.has('Test.Scoped')).toBe(true)
    })

    it('should register an async embedded entry evaluator', async () => {
      // Arrange
      const IsOkAsync = condition('Test.IsOkAsync', { factory: () => async (value: unknown) => value === 'ok' })

      // Act
      const instance = new PackageInstance(
        createForgePackage({
          journey: journeyWithBlocks([fieldWithRule('status', Self().match(IsOkAsync()), 'Not ok')]),
          components: [testInput],
        }),
        { instrumentation: new ForgeTraceSinkDispatcher() },
      )

      // Assert
      const registered = instance.getDependencies().functionRegistry.get('Test.IsOkAsync')

      await expect(registered?.evaluate('ok')).resolves.toBe(true)
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
