import { createForgePackage } from '../authoring/builders'
import { createTestPackage } from './createTestPackage'
import type { ForgeFunctionImplementations } from '../engine/chassis/contracts/ast/engine.type'

describe('createTestPackage()', () => {
  it('should return the package unchanged when no overrides are provided', () => {
    // Arrange
    const original = createForgePackage<{ api: unknown }>({
      journey: { code: 'test', title: 'Test', steps: [] } as any,
      functions: {
        SaveData: (deps: { api: unknown }) => () => deps.api,
      },
    })

    // Act
    const result = createTestPackage(original)

    // Assert
    expect(result.journey).toBe(original.journey)
    expect(result.functions).toEqual(original.functions)
    expect(result.forgePackage).toBe(true)
  })

  it('should replace overridden functions with the provided evaluator', () => {
    // Arrange
    const mockSave = vi.fn()
    const original = createForgePackage<{ api: unknown }>({
      journey: { code: 'test', title: 'Test', steps: [] } as any,
      functions: {
        SaveData: () => () => 'real-save',
        LoadData: () => () => 'real-load',
      },
    })

    // Act
    const result = createTestPackage(original, {
      overrides: { SaveData: mockSave },
    })

    // Assert
    const saveFactory = (result.functions as ForgeFunctionImplementations<any>).SaveData
    const evaluator = saveFactory({} as any)

    expect(evaluator).toBe(mockSave)
  })

  it('should preserve non-overridden functions', () => {
    // Arrange
    const realLoadFactory = () => () => 'real-load'
    const original = createForgePackage<{ api: unknown }>({
      journey: { code: 'test', title: 'Test', steps: [] } as any,
      functions: {
        SaveData: () => () => 'real-save',
        LoadData: realLoadFactory,
      },
    })

    // Act
    const result = createTestPackage(original, {
      overrides: { SaveData: vi.fn() },
    })

    // Assert
    expect((result.functions as ForgeFunctionImplementations<any>).LoadData).toBe(realLoadFactory)
  })

  it('should not mutate the original package', () => {
    // Arrange
    const original = createForgePackage<{ api: unknown }>({
      journey: { code: 'test', title: 'Test', steps: [] } as any,
      functions: {
        SaveData: () => () => 'real-save',
      },
    })

    // Act
    createTestPackage(original, {
      overrides: { SaveData: vi.fn() },
    })

    // Assert
    const originalEvaluator = (original.functions as ForgeFunctionImplementations<any>).SaveData({} as any)

    expect(originalEvaluator()).toBe('real-save')
  })

  it('should preserve journey, components, and enabled fields', () => {
    // Arrange
    const components = [{ variant: 'test', render: () => '' }] as any
    const original = createForgePackage({
      journey: { code: 'test', title: 'Test', steps: [] } as any,
      components,
      enabled: true,
    })

    // Act
    const result = createTestPackage(original)

    // Assert
    expect(result.journey).toBe(original.journey)
    expect(result.components).toBe(components)
    expect(result.enabled).toBe(true)
    expect(result.forgePackage).toBe(true)
  })

  it('should handle packages with no functions defined', () => {
    // Arrange
    const original = createForgePackage({
      journey: { code: 'test', title: 'Test', steps: [] } as any,
    })

    // Act
    const result = createTestPackage(original, {
      overrides: { SaveData: vi.fn() },
    })

    // Assert
    expect((result.functions as ForgeFunctionImplementations<any>).SaveData).toBeDefined()
  })
})
