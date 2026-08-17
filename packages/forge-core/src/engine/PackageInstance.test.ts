import { buildComponent } from '../components/utils/buildComponent'
import { createForgePackage } from '../authoring/builders'
import { StructureType } from '../authoring/types/enums'
import type { JourneyDefinition } from '../authoring/types/structures.type'
import type { CompiledPackage } from './contracts/plans/compilationArtefacts.type'
import CompilationPipeline from './compilation/pipeline/CompilationPipeline'
import ComponentRegistry from './registries/ComponentRegistry'
import FunctionRegistry from './registries/FunctionRegistry'
import ScopedComponentRegistry from './registries/ScopedComponentRegistry'
import ScopedFunctionRegistry from './registries/ScopedFunctionRegistry'
import ForgeTraceSinkDispatcher from './tracing/ForgeTraceSinkDispatcher'
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

      // Act
      const instance = new PackageInstance(
        createForgePackage({
          journey: createJourneyDefinition(),
          functions: {
            WithPrefix: (deps: { prefix: string }) => (value: unknown) => `${deps.prefix}${String(value)}`,
          },
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
      const globalComponent = buildComponent('global-component', () => '<div>Global</div>')
      const packageComponent = buildComponent('package-component', () => '<div>Package</div>')

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
  })
})

function mockCompilation(): void {
  vi.spyOn(CompilationPipeline.prototype, 'compile')
    .mockReturnValue(createCompilationResult())
}

function createJourneyDefinition(): JourneyDefinition {
  return {
    type: StructureType.JOURNEY,
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
