import { z } from 'zod'
import ConditionRegistry from '../../authoring/registries/ConditionRegistry'
import TransformerRegistry from '../../authoring/registries/TransformerRegistry'
import EffectRegistry from '../../authoring/registries/EffectRegistry'
import GeneratorRegistry from '../../authoring/registries/GeneratorRegistry'
import { FunctionType } from '../../authoring/types/enums'
import { createTestEffectContext } from './createTestEffectContext'
import { FunctionRegistryTestHarness } from './FunctionRegistryTestHarness'

describe('FunctionRegistryTestHarness', () => {
  describe('evaluate()', () => {
    it('should return the condition result when a value is supplied via withInput', () => {
      // Arrange
      const conditions = new ConditionRegistry()
      const isYes = conditions.register('isYes', { factory: () => (value: any) => value === 'yes' })
      const harness = new FunctionRegistryTestHarness(conditions)

      // Act
      const whenMatching = harness.evaluate(isYes()).withInput('yes')
      const whenNotMatching = harness.evaluate(isYes()).withInput('no')

      // Assert
      expect(whenMatching).toBe(true)
      expect(whenNotMatching).toBe(false)
    })

    it('should return the transformed value when a value is supplied via withInput', () => {
      // Arrange
      const transformers = new TransformerRegistry()
      const shout = transformers.register('shout', { factory: () => (value: any) => `${value}!` })
      const harness = new FunctionRegistryTestHarness(transformers)

      // Act
      const result = harness.evaluate(shout()).withInput('hi')

      // Assert
      expect(result).toBe('hi!')
    })

    it('should execute a generator immediately from its builder handle without withInput', () => {
      // Arrange
      const generators = new GeneratorRegistry()
      const constant = generators.register('constant', { factory: () => () => 42 })
      const harness = new FunctionRegistryTestHarness(generators)

      // Act
      const result = harness.evaluate(constant())

      // Assert
      expect(result).toBe(42)
    })

    it('should run an effect against the supplied context via withContext', () => {
      // Arrange
      const effects = new EffectRegistry()
      const stamp = effects.register('stamp', { factory: () => (context: any) => context.setAnswer('stamped', true) })
      const harness = new FunctionRegistryTestHarness(effects)
      const context = createTestEffectContext()

      // Act
      harness.evaluate(stamp()).withContext(context)

      // Assert
      expect(context.getAnswer('stamped')).toBe(true)
    })

    it('should pass the constructor deps to the registry factory', () => {
      // Arrange
      interface Deps {
        prefix: string
      }
      const generators = new GeneratorRegistry<Deps>()
      const prefixed = generators.register('prefixed', {
        factory:
          ({ prefix }) =>
          () =>
            `${prefix}-value`,
      })
      const harness = new FunctionRegistryTestHarness(generators, { prefix: 'test' })

      // Act
      const result = harness.evaluate(prefixed())

      // Assert
      expect(result).toBe('test-value')
    })

    it('should throw a TypeError when the arguments fail the argumentsSchema', () => {
      // Arrange
      const conditions = new ConditionRegistry()
      const atMost = conditions.register('atMost', {
        argumentsSchema: z.tuple([z.number()]),
        factory: () => (value: any, max: number) => value <= max,
      })
      const harness = new FunctionRegistryTestHarness(conditions)

      // Act
      const act = () => harness.evaluate(atMost('not-a-number' as any)).withInput(5)

      // Assert
      expect(act).toThrow(TypeError)
    })

    it('should short-circuit a condition to false without calling it when the input is undefined', () => {
      // Arrange
      const conditions = new ConditionRegistry()
      let called = false
      const isYes = conditions.register('isYes', {
        factory: () => (value: any) => {
          called = true

          return value === 'yes'
        },
      })
      const harness = new FunctionRegistryTestHarness(conditions)

      // Act
      const result = harness.evaluate(isYes()).withInput(undefined)

      // Assert
      expect(result).toBe(false)
      expect(called).toBe(false)
    })

    it('should short-circuit a transformer to undefined without calling it when the input is undefined', () => {
      // Arrange
      const transformers = new TransformerRegistry()
      let called = false
      const shout = transformers.register('shout', {
        factory: () => (value: any) => {
          called = true

          return `${value}!`
        },
      })
      const harness = new FunctionRegistryTestHarness(transformers)

      // Act
      const result = harness.evaluate(shout()).withInput(undefined)

      // Assert
      expect(result).toBeUndefined()
      expect(called).toBe(false)
    })

    it('should fail a condition soft to false when the input fails the inputSchema', () => {
      // Arrange
      const conditions = new ConditionRegistry()
      const needsString = conditions.register('needsString', { inputSchema: z.string(), factory: () => () => true })
      const harness = new FunctionRegistryTestHarness(conditions)

      // Act
      const result = harness.evaluate(needsString()).withInput(123)

      // Assert
      expect(result).toBe(false)
    })

    it('should throw a TypeError when a transformer input fails the inputSchema', () => {
      // Arrange
      const transformers = new TransformerRegistry()
      const upper = transformers.register('upper', {
        inputSchema: z.string(),
        factory: () => (value: string) => value.toUpperCase(),
      })
      const harness = new FunctionRegistryTestHarness(transformers)

      // Act
      const act = () => harness.evaluate(upper()).withInput(123)

      // Assert
      expect(act).toThrow(TypeError)
    })

    it('should throw a TypeError when a condition returns a non-boolean against the default output schema', () => {
      // Arrange
      const conditions = new ConditionRegistry()
      const broken = conditions.register('broken', { factory: () => () => 'not-a-boolean' as any })
      const harness = new FunctionRegistryTestHarness(conditions)

      // Act
      const act = () => harness.evaluate(broken()).withInput('x')

      // Assert
      expect(act).toThrow(TypeError)
    })

    it('should return a promise resolving to the validated value when the function is async', async () => {
      // Arrange
      const transformers = new TransformerRegistry()
      const asyncDouble = transformers.register('asyncDouble', { factory: () => async (value: number) => value * 2 })
      const harness = new FunctionRegistryTestHarness(transformers)

      // Act
      const result = harness.evaluate(asyncDouble()).withInput(5)

      // Assert
      expect(result).toBeInstanceOf(Promise)
      await expect(result).resolves.toBe(10)
    })

    it('should reject with a TypeError when an async result fails the outputSchema', async () => {
      // Arrange
      const transformers = new TransformerRegistry()
      const asyncBad = transformers.register('asyncBad', {
        outputSchema: z.number(),
        factory: () => async () => 'not-a-number',
      })
      const harness = new FunctionRegistryTestHarness(transformers)

      // Act
      const result = harness.evaluate(asyncBad()).withInput(1)

      // Assert
      await expect(result).rejects.toBeInstanceOf(TypeError)
    })

    it('should return a promise and mutate the context when an async effect runs via withContext', async () => {
      // Arrange
      const effects = new EffectRegistry()
      const asyncStamp = effects.register('asyncStamp', {
        factory: () => async (context: any) => {
          context.setAnswer('done', true)
        },
      })
      const harness = new FunctionRegistryTestHarness(effects)
      const context = createTestEffectContext()

      // Act
      const result = harness.evaluate(asyncStamp()).withContext(context)

      // Assert
      expect(result).toBeInstanceOf(Promise)
      await result
      expect(context.getAnswer('done')).toBe(true)
    })

    it('should throw naming the unknown function and the registered functions when the name is not registered', () => {
      // Arrange
      const conditions = new ConditionRegistry()
      conditions.register('alpha', { factory: () => () => true })
      conditions.register('beta', { factory: () => () => true })
      const harness = new FunctionRegistryTestHarness(conditions)

      // Act
      const act = () => harness.evaluate({ type: FunctionType.CONDITION, name: 'missing', arguments: [] })

      // Assert
      expect(act).toThrow('Function "missing" is not registered in this harness. Registered functions: alpha, beta')
    })

    it('should evaluate functions from every registry when an array is passed', () => {
      // Arrange
      const conditions = new ConditionRegistry()
      const isYes = conditions.register('isYes', { factory: () => (value: any) => value === 'yes' })
      const transformers = new TransformerRegistry()
      const shout = transformers.register('shout', { factory: () => (value: any) => `${value}!` })
      const harness = new FunctionRegistryTestHarness([conditions, transformers])

      // Act
      const conditionResult = harness.evaluate(isYes()).withInput('yes')
      const transformerResult = harness.evaluate(shout()).withInput('hi')

      // Assert
      expect(conditionResult).toBe(true)
      expect(transformerResult).toBe('hi!')
    })
  })

  describe('constructor()', () => {
    it('should throw naming the duplicate when a name is registered across two registries', () => {
      // Arrange
      const first = new ConditionRegistry()
      first.register('dup', { factory: () => () => true })
      const second = new ConditionRegistry()
      second.register('dup', { factory: () => () => false })

      // Act
      const act = () => new FunctionRegistryTestHarness([first, second])

      // Assert
      expect(act).toThrow('dup')
    })
  })
})
