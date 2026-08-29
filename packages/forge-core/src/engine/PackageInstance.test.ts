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
import ForgeTraceSinkDispatcher from './chassis/tracing/ForgeTraceSinkDispatcher'
import PackageInstance from './PackageInstance'

describe('PackageInstance', () => {
  describe('constructor()', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('should retain empty function builders when the package has no registrations', () => {
      // Arrange
      mockCompilation()

      // Act
      const instance = new PackageInstance(createForgePackage({ journey: createJourneyDefinition() }), {
        instrumentation: new ForgeTraceSinkDispatcher(),
      })

      // Assert
      expect(instance.getDependencies().functionBuilders).toEqual([])
      expect(instance.getDependencies().packageDependencies).toEqual({})
      expect(instance.getDependencies().componentRegistry).toBeInstanceOf(ComponentRegistry)
      expect(instance.getDependencies().componentRegistry.size()).toBe(0)
    })

    it('should retain package functions and dependencies without invoking factories', () => {
      // Arrange
      mockCompilation()

      const packageDependencies = { prefix: 'case-' }
      const factory = vi.fn(
        (dependencies: typeof packageDependencies) => (value: unknown) => `${dependencies.prefix}${String(value)}`,
      )
      const packageFunctions = new TransformerRegistry<typeof packageDependencies>()
      packageFunctions.register('WithPrefix', factory)

      // Act
      const instance = new PackageInstance(
        createForgePackage({
          journey: createJourneyDefinition(),
          functions: packageFunctions,
        }),
        {
          packageDependencies,
          instrumentation: new ForgeTraceSinkDispatcher(),
        },
      )

      // Assert
      expect(instance.getDependencies().functionBuilders).toEqual([packageFunctions])
      expect(instance.getDependencies().packageDependencies).toBe(packageDependencies)
      expect(factory).not.toHaveBeenCalled()
    })

    it('should reject duplicate definitions across package function builders', () => {
      // Arrange
      mockCompilation()

      const firstFunctions = new TransformerRegistry()
      const secondFunctions = new TransformerRegistry()
      firstFunctions.register('Duplicate', () => value => value)
      secondFunctions.register('Duplicate', () => value => value)

      // Act
      const act = () =>
        new PackageInstance(
          createForgePackage({
            journey: createJourneyDefinition(),
            functions: [firstFunctions, secondFunctions],
          }),
          { instrumentation: new ForgeTraceSinkDispatcher() },
        )

      // Assert
      expect(act).toThrow('Function definition registration failed')
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
      const [functionBuilder] = instance.getDependencies().functionBuilders

      expect(functionBuilder.getDefinitions()).toHaveProperty('Test.Scoped')
    })

    it('should compile an async embedded entry without invoking its factory', () => {
      // Arrange
      const factory = vi.fn(() => async (value: unknown) => value === 'ok')
      const IsOkAsync = condition('Test.IsOkAsync', { factory })

      // Act
      const instance = new PackageInstance(
        createForgePackage({
          journey: journeyWithBlocks([fieldWithRule('status', Self().match(IsOkAsync()), 'Not ok')]),
          components: [testInput],
        }),
        { instrumentation: new ForgeTraceSinkDispatcher() },
      )

      // Assert
      expect(instance.getDependencies().functionBuilders[0].getDefinitions()).toHaveProperty('Test.IsOkAsync')
      expect(factory).not.toHaveBeenCalled()
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
