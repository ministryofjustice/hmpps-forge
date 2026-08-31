import { z } from 'zod'
import {
  StructureType,
  HookType,
  PolicyType,
  FunctionCallType,
  PredicateType,
  ExpressionType,
  ComponentCallType,
  FunctionEntryType,
  IteratorType,
} from '../../../shared/taxonomy'
import type { ReferenceExpr } from '../../../authoring/types/expressions.type'
import type { JourneyDefinition, StepDefinition } from '../../../authoring/types/structures.type'
import type { FieldBlockDefinition, BlockDefinition, ResolvableString } from '../../../components/types/structures.type'
import FunctionRegistry from '../../chassis/registries/FunctionRegistry'
import ConditionRegistry from '../../../authoring/registries/ConditionRegistry'
import TransformerRegistry from '../../../authoring/registries/TransformerRegistry'
import ForgeReferenceScopeError from '../../errors/ForgeReferenceScopeError'
import ForgeUnregisteredFunctionError from '../../errors/ForgeUnregisteredFunctionError'
import ForgeUnregisteredComponentError from '../../errors/ForgeUnregisteredComponentError'
import ForgeFunctionArityError from '../../errors/ForgeFunctionArityError'
import CompilationPipeline from '../../chassis/compilation/pipeline/CompilationPipeline'
import { finaliseBuilders } from '../../../authoring/builders/utils/finaliseBuilders'

function createTestComponent(variant: string, render: () => string) {
  return { variant, render }
}

class RenderFunctionRegistry extends FunctionRegistry {
  registerMany(components: ReturnType<typeof createTestComponent>[]): void {
    this.register(
      Object.fromEntries(
        components.map(component => [
          component.variant,
          {
            name: component.variant,
            _forge: FunctionEntryType.COMPONENT,
            evaluate: component.render,
          },
        ]),
      ),
    )
  }
}

function compileJourney(
  journey: JourneyDefinition,
  functionRegistry: FunctionRegistry,
  renderFunctionRegistry: RenderFunctionRegistry,
): void {
  const combinedRegistry = new FunctionRegistry()

  combinedRegistry.register(Object.fromEntries([...functionRegistry.getAll(), ...renderFunctionRegistry.getAll()]))
  const pipeline = new CompilationPipeline({ functionRegistry: combinedRegistry })

  pipeline.compile(finaliseBuilders(journey) as JourneyDefinition)
}

describe('ASTSemanticValidator', () => {
  describe('reference scopes', () => {
    const functionRegistry = new FunctionRegistry()
    functionRegistry.register({
      IsRequired: { name: 'IsRequired', evaluate: () => true },
    })

    const renderFunctionRegistry = new RenderFunctionRegistry()
    renderFunctionRegistry.registerMany([
      createTestComponent('GovUKInput', () => '<input />'),
      createTestComponent('collection-block', () => '<div />'),
    ])

    const createBaseJourney = (overrides: Partial<JourneyDefinition> = {}): JourneyDefinition => ({
      _forge: StructureType.JOURNEY,
      path: '/travel-declaration',
      code: 'travel-declaration',
      title: 'Travel Declaration',
      steps: [],
      ...overrides,
    })

    const createReference = (path: string[]): ReferenceExpr => ({
      _forge: ExpressionType.REFERENCE,
      path,
    })

    type RawBasicBlockDefinition = BlockDefinition & Record<string, unknown>
    type RawFieldBlockDefinition = FieldBlockDefinition & Record<string, unknown>

    const createBasicBlock = (
      properties: Partial<BlockDefinition> & Record<string, unknown>,
    ): RawBasicBlockDefinition => ({
      _forge: ComponentCallType.BASIC,
      variant: 'collection-block',
      ...properties,
    })

    const createFieldBlock = (
      properties: Pick<FieldBlockDefinition, 'code'> & Partial<FieldBlockDefinition> & Record<string, unknown>,
    ): RawFieldBlockDefinition => ({
      _forge: ComponentCallType.FIELD,
      variant: 'GovUKInput',
      ...properties,
    })

    it('should reject Item references outside iterators', () => {
      // Arrange
      const journey = createBaseJourney({
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/personal-details',
            title: 'Personal details',
            blocks: [
              createFieldBlock({
                code: 'firstName',
                defaultValue: createReference(['@scope', '0', 'firstName']) as unknown as ResolvableString,
              }),
            ],
          } as StepDefinition,
        ],
      })

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, renderFunctionRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeError = error.errors[0]

          expect(scopeError).toBeInstanceOf(ForgeReferenceScopeError)
          expect(scopeError.message).toContain('can only be used inside an iterator')
        }
      }
    })

    it('should reject parent Item references when there is no parent iterator', () => {
      // Arrange
      const journey = createBaseJourney({
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/trips',
            title: 'Trips',
            blocks: [
              createBasicBlock({
                collection: {
                  _forge: ExpressionType.ITERATE,
                  input: createReference(['answers', 'trips']),
                  iterator: {
                    _forge: IteratorType.MAP,
                    yield: {
                      blocks: [
                        {
                          _forge: ComponentCallType.FIELD,
                          variant: 'GovUKInput',
                          code: 'country',
                          defaultValue: createReference(['@scope', '1', 'country']),
                        },
                      ],
                    },
                  },
                },
              }),
            ],
          } as StepDefinition,
        ],
      })

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, renderFunctionRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeError = error.errors[0]

          expect(scopeError).toBeInstanceOf(ForgeReferenceScopeError)
          expect(scopeError.message).toBe('Item().parent references level 1, but only 1 iterator scope is available')
        }
      }
    })

    it('should reject invalid Loop properties inside iterators', () => {
      // Arrange
      const journey = createBaseJourney({
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/trips',
            title: 'Trips',
            blocks: [
              createBasicBlock({
                collection: {
                  _forge: ExpressionType.ITERATE,
                  input: createReference(['answers', 'trips']),
                  iterator: {
                    _forge: IteratorType.MAP,
                    yield: {
                      blocks: [
                        {
                          _forge: ComponentCallType.FIELD,
                          variant: 'GovUKInput',
                          code: 'country',
                          defaultValue: createReference(['@loop', '0', 'banana']),
                        },
                      ],
                    },
                  },
                },
              }),
            ],
          } as StepDefinition,
        ],
      })

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, renderFunctionRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeError = error.errors[0]

          expect(scopeError).toBeInstanceOf(ForgeReferenceScopeError)
          expect(scopeError.message).toContain('Loop reference property must be one of')
        }
      }
    })

    it('should collect multiple reference scope errors', () => {
      // Arrange
      const journey = createBaseJourney({
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/personal-details',
            title: 'Personal details',
            blocks: [
              createFieldBlock({
                code: 'firstName',
                defaultValue: createReference(['@scope', 'banana', 'firstName']) as unknown as ResolvableString,
                label: { text: createReference(['@loop', '0', 'index0']) },
              }),
            ],
          } as StepDefinition,
        ],
      })

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, renderFunctionRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const messages = error.errors.map((scopeError: ForgeReferenceScopeError) => scopeError.message)

          expect(error.errors).toHaveLength(2)
          expect(messages).toContain('Loop reference level must be a non-negative integer')
          expect(messages).toContain('Loop can only be used inside an iterator')
        }
      }
    })

    it('should allow Item and Loop parent references inside nested iterators', () => {
      // Arrange
      const journey = createBaseJourney({
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/teams',
            title: 'Teams',
            blocks: [
              createBasicBlock({
                collection: {
                  _forge: ExpressionType.ITERATE,
                  input: createReference(['data', 'teams']),
                  iterator: {
                    _forge: IteratorType.MAP,
                    yield: {
                      collection: {
                        _forge: ExpressionType.ITERATE,
                        input: createReference(['@scope', '0', 'members']),
                        iterator: {
                          _forge: IteratorType.MAP,
                          yield: {
                            blocks: [
                              {
                                _forge: ComponentCallType.FIELD,
                                variant: 'GovUKInput',
                                code: 'memberName',
                                defaultValue: {
                                  teamName: createReference(['@scope', '1', 'name']),
                                  teamIndex: createReference(['@loop', '1', 'index0']),
                                  memberName: createReference(['@scope', '0', 'name']),
                                  memberIndex: createReference(['@loop', '0', 'index0']),
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              }),
            ],
          } as StepDefinition,
        ],
      })

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).not.toThrow()
    })
  })

  describe('function registration', () => {
    const createFnRegistry = (...names: string[]): FunctionRegistry => {
      const registry = new FunctionRegistry()

      if (names.length > 0) {
        const entries: Record<string, { name: string; evaluate: () => void }> = {}

        names.forEach(name => {
          entries[name] = { name, evaluate: () => {} }
        })

        registry.register(entries)
      }

      return registry
    }

    const renderRegistry = new RenderFunctionRegistry()
    renderRegistry.registerMany([
      createTestComponent('text', () => '<input />'),
      createTestComponent('radio', () => '<radio />'),
    ])

    const baseJourney: JourneyDefinition = {
      _forge: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should not throw when journey has no function references', () => {
      // Arrange
      const registry = createFnRegistry()

      // Act / Assert
      expect(() => compileJourney(baseJourney, registry, renderRegistry)).not.toThrow()
    })

    it('should not throw when all referenced functions are registered', () => {
      // Arrange
      const registry = createFnRegistry('isEqualTo', 'saveToApi')

      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onSubmission: [
              {
                _forge: HookType.SUBMIT,
                validate: true,
                onValid: {
                  effects: [{ _forge: FunctionCallType.EFFECT, name: 'saveToApi', arguments: [] }],
                  next: [{ _forge: PolicyType.OUTCOME_REDIRECT, goto: '/next' }],
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, registry, renderRegistry)).not.toThrow()
    })

    it('should throw when an effect is not registered', () => {
      // Arrange
      const registry = createFnRegistry()

      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onSubmission: [
              {
                _forge: HookType.SUBMIT,
                onValid: {
                  effects: [{ _forge: FunctionCallType.EFFECT, name: 'nonExistentEffect', arguments: [] }],
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, registry, renderRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, registry, renderRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const fnErrors = error.errors.filter((e: Error) => e instanceof ForgeUnregisteredFunctionError)

          expect(fnErrors).toHaveLength(1)
          expect(fnErrors[0].functionName).toBe('nonExistentEffect')
          expect(fnErrors[0].functionType).toBe(FunctionCallType.EFFECT)
        }
      }
    })

    it('should throw when a condition is not registered', () => {
      // Arrange
      const registry = createFnRegistry()

      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
                validWhen: [
                  {
                    _forge: PolicyType.VALIDATION_RULE,
                    message: 'Required',
                    condition: {
                      _forge: PredicateType.TEST,
                      subject: { _forge: ExpressionType.REFERENCE, path: ['field1'] },
                      negate: false,
                      condition: { _forge: FunctionCallType.CONDITION, name: 'missingCondition', arguments: [] },
                    },
                  },
                ],
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, registry, renderRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, registry, renderRegistry)
      } catch (error) {
        if (error instanceof AggregateError) {
          const fnErrors = error.errors.filter((e: Error) => e instanceof ForgeUnregisteredFunctionError)

          expect(fnErrors).toHaveLength(1)
          expect(fnErrors[0].functionName).toBe('missingCondition')
          expect(fnErrors[0].functionType).toBe(FunctionCallType.CONDITION)
        }
      }
    })

    it('should collect multiple unregistered function errors', () => {
      // Arrange
      const registry = createFnRegistry('registeredEffect')

      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onAccess: [
              {
                _forge: HookType.ACCESS,
                effects: [
                  { _forge: FunctionCallType.EFFECT, name: 'registeredEffect', arguments: [] },
                  { _forge: FunctionCallType.EFFECT, name: 'missingEffect1', arguments: [] },
                ],
              },
            ],
            onSubmission: [
              {
                _forge: HookType.SUBMIT,
                onValid: {
                  effects: [{ _forge: FunctionCallType.EFFECT, name: 'missingEffect2', arguments: [] }],
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      try {
        compileJourney(journey, registry, renderRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const fnErrors = error.errors.filter((e: Error) => e instanceof ForgeUnregisteredFunctionError)

          expect(fnErrors).toHaveLength(2)

          const names = fnErrors.map((e: ForgeUnregisteredFunctionError) => e.functionName)
          expect(names).toContain('missingEffect1')
          expect(names).toContain('missingEffect2')
        }
      }
    })

    it('should find unregistered functions in nested child journeys', () => {
      // Arrange
      const registry = createFnRegistry()

      const journey: JourneyDefinition = {
        ...baseJourney,
        children: [
          {
            _forge: StructureType.JOURNEY,
            path: '/child',
            code: 'child',
            title: 'Child',
            steps: [
              {
                _forge: StructureType.STEP,
                path: '/nested-step',
                title: 'Nested',
                blocks: [],
                onAccess: [
                  {
                    _forge: HookType.ACCESS,
                    effects: [{ _forge: FunctionCallType.EFFECT, name: 'deeplyNestedEffect', arguments: [] }],
                  },
                ],
              } as StepDefinition,
            ],
          },
        ],
      }

      // Act / Assert
      try {
        compileJourney(journey, registry, renderRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const fnErrors = error.errors.filter((e: Error) => e instanceof ForgeUnregisteredFunctionError)

          expect(fnErrors).toHaveLength(1)
          expect(fnErrors[0].functionName).toBe('deeplyNestedEffect')
        }
      }
    })

    it('should detect unregistered transformer and generator functions', () => {
      // Arrange
      const registry = createFnRegistry()

      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: { _forge: FunctionCallType.GENERATOR, name: 'missingGenerator', arguments: [] },
                formatters: [{ _forge: FunctionCallType.TRANSFORMER, name: 'missingTransformer', arguments: [] }],
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      try {
        compileJourney(journey, registry, renderRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const fnErrors = error.errors.filter((e: Error) => e instanceof ForgeUnregisteredFunctionError)

          expect(fnErrors).toHaveLength(2)

          const types = fnErrors.map((e: ForgeUnregisteredFunctionError) => e.functionType)
          expect(types).toContain(FunctionCallType.GENERATOR)
          expect(types).toContain(FunctionCallType.TRANSFORMER)
        }
      }
    })
  })

  describe('component registration', () => {
    const createRenderRegistry = (...variants: string[]): RenderFunctionRegistry => {
      const registry = new RenderFunctionRegistry()

      if (variants.length > 0) {
        registry.registerMany(variants.map(variant => createTestComponent(variant, () => `<${variant} />`)))
      }

      return registry
    }

    const fnRegistry = new FunctionRegistry()

    const baseJourney: JourneyDefinition = {
      _forge: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should not throw when journey has no blocks', () => {
      // Arrange
      const registry = createRenderRegistry()

      // Act / Assert
      expect(() => compileJourney(baseJourney, fnRegistry, registry)).not.toThrow()
    })

    it('should not throw when all block variants are registered', () => {
      // Arrange
      const registry = createRenderRegistry('text', 'radio')

      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
              } as FieldBlockDefinition,
              {
                _forge: ComponentCallType.BASIC,
                variant: 'radio',
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, fnRegistry, registry)).not.toThrow()
    })

    it('should throw when a block variant is not registered', () => {
      // Arrange
      const registry = createRenderRegistry()

      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'nonExistentComponent',
                code: 'field1',
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, fnRegistry, registry)).toThrow(AggregateError)

      try {
        compileJourney(journey, fnRegistry, registry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(1)
          expect(error.errors[0]).toBeInstanceOf(ForgeUnregisteredComponentError)
          expect(error.errors[0].variant).toBe('nonExistentComponent')
        }
      }
    })

    it('should collect multiple unregistered component errors', () => {
      // Arrange
      const registry = createRenderRegistry('text')

      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
              },
              {
                _forge: ComponentCallType.FIELD,
                variant: 'missingRadio',
                code: 'field2',
              },
              {
                _forge: ComponentCallType.BASIC,
                variant: 'missingCheckbox',
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      try {
        compileJourney(journey, fnRegistry, registry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(2)

          const variants = error.errors.map((e: ForgeUnregisteredComponentError) => e.variant)
          expect(variants).toContain('missingRadio')
          expect(variants).toContain('missingCheckbox')
        }
      }
    })

    it('should find unregistered components in nested child journeys', () => {
      // Arrange
      const registry = createRenderRegistry()

      const journey: JourneyDefinition = {
        ...baseJourney,
        children: [
          {
            _forge: StructureType.JOURNEY,
            path: '/child',
            code: 'child',
            title: 'Child',
            steps: [
              {
                _forge: StructureType.STEP,
                path: '/nested-step',
                title: 'Nested',
                blocks: [
                  {
                    _forge: ComponentCallType.FIELD,
                    variant: 'deeplyNestedComponent',
                    code: 'field1',
                  } as FieldBlockDefinition,
                ],
              } as StepDefinition,
            ],
          },
        ],
      }

      // Act / Assert
      try {
        compileJourney(journey, fnRegistry, registry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(1)
          expect(error.errors[0].variant).toBe('deeplyNestedComponent')
        }
      }
    })
  })

  describe('effect scope', () => {
    const functionRegistry = new FunctionRegistry()
    functionRegistry.register({
      saveToApi: { name: 'saveToApi', evaluate: () => {} },
      loadData: { name: 'loadData', evaluate: () => {} },
      IsRequired: { name: 'IsRequired', evaluate: () => true },
    })

    const renderFunctionRegistry = new RenderFunctionRegistry()
    renderFunctionRegistry.registerMany([createTestComponent('text', () => '<input />')])

    const baseJourney: JourneyDefinition = {
      _forge: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should allow effects inside access hooks', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onAccess: [
              {
                _forge: HookType.ACCESS,
                effects: [{ _forge: FunctionCallType.EFFECT, name: 'loadData', arguments: [] }],
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).not.toThrow()
    })

    it('should allow effects inside submit hooks', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onSubmission: [
              {
                _forge: HookType.SUBMIT,
                onValid: {
                  effects: [{ _forge: FunctionCallType.EFFECT, name: 'saveToApi', arguments: [] }],
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).not.toThrow()
    })

    it('should not reject non-effect functions outside hooks', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
                validWhen: [
                  {
                    _forge: PolicyType.VALIDATION_RULE,
                    message: 'Required',
                    condition: {
                      _forge: PredicateType.TEST,
                      subject: { _forge: ExpressionType.REFERENCE, path: ['field1'] },
                      negate: false,
                      condition: { _forge: FunctionCallType.CONDITION, name: 'IsRequired', arguments: [] },
                    },
                  },
                ],
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).not.toThrow()
    })

    it('should reject an effect outside a hook', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: { _forge: FunctionCallType.EFFECT, name: 'saveToApi', arguments: [] },
              } as unknown as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, renderFunctionRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter((e: ForgeReferenceScopeError) => e.message.startsWith('Effect '))

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })

  })

  describe('function argument scope', () => {
    const functionRegistry = new FunctionRegistry()
    functionRegistry.register({
      someTransformer: { name: 'someTransformer', evaluate: () => 'value' },
      someCondition: { name: 'someCondition', evaluate: () => true },
      IsRequired: { name: 'IsRequired', evaluate: () => true },
    })

    const renderFunctionRegistry = new RenderFunctionRegistry()
    renderFunctionRegistry.registerMany([
      createTestComponent('text', () => '<input />'),
      createTestComponent('collection-block', () => '<div />'),
    ])

    const baseJourney: JourneyDefinition = {
      _forge: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should reject a block inside function arguments', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: {
                  _forge: FunctionCallType.TRANSFORMER,
                  name: 'someTransformer',
                  arguments: [
                    {
                      _forge: ComponentCallType.BASIC,
                      variant: 'text',
                    },
                  ],
                },
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, renderFunctionRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeReferenceScopeError) => e.message === 'Block definitions cannot be used as function arguments',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })

    it('should reject a validation inside function arguments', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: {
                  _forge: FunctionCallType.TRANSFORMER,
                  name: 'someTransformer',
                  arguments: [
                    {
                      _forge: PolicyType.VALIDATION_RULE,
                      message: 'Required',
                      condition: {
                        _forge: PredicateType.TEST,
                        subject: { _forge: ExpressionType.REFERENCE, path: ['field1'] },
                        negate: false,
                        condition: { _forge: FunctionCallType.CONDITION, name: 'IsRequired', arguments: [] },
                      },
                    },
                  ],
                },
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, renderFunctionRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeReferenceScopeError) =>
              e.message === 'Validation rules can only be used inside validWhen on a field block or step',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })

    it('should not reject blocks and functions in their normal positions', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: {
                  _forge: FunctionCallType.TRANSFORMER,
                  name: 'someTransformer',
                  arguments: [{ _forge: ExpressionType.REFERENCE, path: ['answers', 'name'] }],
                },
                validWhen: [
                  {
                    _forge: PolicyType.VALIDATION_RULE,
                    message: 'Required',
                    condition: {
                      _forge: PredicateType.TEST,
                      subject: { _forge: ExpressionType.REFERENCE, path: ['field1'] },
                      negate: false,
                      condition: { _forge: FunctionCallType.CONDITION, name: 'IsRequired', arguments: [] },
                    },
                  },
                ],
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).not.toThrow()
    })

    it('should collect multiple function argument scope errors', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: {
                  _forge: FunctionCallType.TRANSFORMER,
                  name: 'someTransformer',
                  arguments: [
                    {
                      _forge: ComponentCallType.BASIC,
                      variant: 'text',
                    },
                    {
                      _forge: PolicyType.VALIDATION_RULE,
                      message: 'Required',
                      condition: {
                        _forge: PredicateType.TEST,
                        subject: { _forge: ExpressionType.REFERENCE, path: ['field1'] },
                        negate: false,
                        condition: { _forge: FunctionCallType.CONDITION, name: 'IsRequired', arguments: [] },
                      },
                    },
                  ],
                },
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, renderFunctionRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const messages = error.errors
            .filter((e: Error) => e instanceof ForgeReferenceScopeError)
            .map((e: ForgeReferenceScopeError) => e.message)

          expect(messages).toContain('Block definitions cannot be used as function arguments')
          expect(messages).toContain('Validation rules can only be used inside validWhen on a field block or step')
        }
      }
    })

    it('should reject blocks inside function arguments in iterator templates', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.BASIC,
                variant: 'collection-block',
                collection: {
                  _forge: ExpressionType.ITERATE,
                  input: { _forge: ExpressionType.REFERENCE, path: ['data', 'items'] },
                  iterator: {
                    _forge: IteratorType.MAP,
                    yield: {
                      blocks: [
                        {
                          _forge: ComponentCallType.FIELD,
                          variant: 'text',
                          code: 'item',
                          defaultValue: {
                            _forge: FunctionCallType.TRANSFORMER,
                            name: 'someTransformer',
                            arguments: [
                              {
                                _forge: ComponentCallType.BASIC,
                                variant: 'text',
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                },
              } as BlockDefinition & Record<string, unknown>,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, renderFunctionRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeReferenceScopeError) => e.message === 'Block definitions cannot be used as function arguments',
          )

          expect(scopeErrors.length).toBeGreaterThanOrEqual(1)
        }
      }
    })
  })

  describe('validation scope', () => {
    const functionRegistry = new FunctionRegistry()
    functionRegistry.register({
      IsRequired: { name: 'IsRequired', evaluate: () => true },
      someTransformer: { name: 'someTransformer', evaluate: () => 'value' },
    })

    const renderFunctionRegistry = new RenderFunctionRegistry()
    renderFunctionRegistry.registerMany([
      createTestComponent('text', () => '<input />'),
      createTestComponent('collection-block', () => '<div />'),
    ])

    const baseJourney: JourneyDefinition = {
      _forge: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should allow validations in field block validWhen', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
                validWhen: [
                  {
                    _forge: PolicyType.VALIDATION_RULE,
                    message: 'Required',
                    condition: {
                      _forge: PredicateType.TEST,
                      subject: { _forge: ExpressionType.REFERENCE, path: ['field1'] },
                      negate: false,
                      condition: { _forge: FunctionCallType.CONDITION, name: 'IsRequired', arguments: [] },
                    },
                  },
                ],
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).not.toThrow()
    })

    it('should allow validations in step validWhen', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            validWhen: [
              {
                _forge: PolicyType.VALIDATION_RULE,
                message: 'Step is not valid',
                condition: {
                  _forge: PredicateType.TEST,
                  subject: { _forge: ExpressionType.REFERENCE, path: ['answers', 'name'] },
                  negate: false,
                  condition: { _forge: FunctionCallType.CONDITION, name: 'IsRequired', arguments: [] },
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).not.toThrow()
    })

    it('should reject a validation in a basic block property', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.BASIC,
                variant: 'text',
                content: {
                  _forge: PolicyType.VALIDATION_RULE,
                  message: 'Misplaced',
                  condition: {
                    _forge: PredicateType.TEST,
                    subject: { _forge: ExpressionType.REFERENCE, path: ['field1'] },
                    negate: false,
                    condition: { _forge: FunctionCallType.CONDITION, name: 'IsRequired', arguments: [] },
                  },
                },
              } as BlockDefinition & Record<string, unknown>,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, renderFunctionRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeReferenceScopeError) =>
              e.message === 'Validation rules can only be used inside validWhen on a field block or step',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })

    it('should not reject non-validation expressions in other positions', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: {
                  _forge: FunctionCallType.TRANSFORMER,
                  name: 'someTransformer',
                  arguments: [{ _forge: ExpressionType.REFERENCE, path: ['answers', 'name'] }],
                },
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).not.toThrow()
    })

    it('should allow validations inside iterator yield templates when the iterator is in validWhen', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
                validWhen: [
                  {
                    _forge: ExpressionType.ITERATE,
                    input: {
                      _forge: ExpressionType.ITERATE,
                      input: { _forge: ExpressionType.REFERENCE, path: ['answers', 'goals'] },
                      iterator: {
                        _forge: IteratorType.FILTER,
                        predicate: {
                          _forge: PredicateType.TEST,
                          subject: { _forge: ExpressionType.REFERENCE, path: ['@scope', '0', 'status'] },
                          negate: false,
                          condition: { _forge: FunctionCallType.CONDITION, name: 'IsRequired', arguments: [] },
                        },
                      },
                    },
                    iterator: {
                      _forge: IteratorType.MAP,
                      yield: {
                        _forge: PolicyType.VALIDATION_RULE,
                        message: 'Must have steps',
                        condition: {
                          _forge: PredicateType.TEST,
                          subject: { _forge: ExpressionType.REFERENCE, path: ['@scope', '0', 'steps'] },
                          negate: false,
                          condition: { _forge: FunctionCallType.CONDITION, name: 'IsRequired', arguments: [] },
                        },
                      },
                    },
                  },
                ],
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).not.toThrow()
    })
  })

  describe('outcome scope', () => {
    const functionRegistry = new FunctionRegistry()
    functionRegistry.register({
      saveToApi: { name: 'saveToApi', evaluate: () => {} },
    })

    const renderFunctionRegistry = new RenderFunctionRegistry()
    renderFunctionRegistry.registerMany([createTestComponent('text', () => '<input />')])

    const baseJourney: JourneyDefinition = {
      _forge: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should allow outcomes inside hooks', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onSubmission: [
              {
                _forge: HookType.SUBMIT,
                onValid: {
                  effects: [{ _forge: FunctionCallType.EFFECT, name: 'saveToApi', arguments: [] }],
                  next: [{ _forge: PolicyType.OUTCOME_REDIRECT, goto: '/next' }],
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).not.toThrow()
    })

  })

  describe('hook scope', () => {
    const functionRegistry = new FunctionRegistry()
    const renderFunctionRegistry = new RenderFunctionRegistry()
    renderFunctionRegistry.registerMany([createTestComponent('text', () => '<input />')])

    const baseJourney: JourneyDefinition = {
      _forge: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should allow hooks on steps and journeys', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        onAccess: [{ _forge: HookType.ACCESS, next: [{ _forge: PolicyType.OUTCOME_REDIRECT, goto: '/login' }] }],
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onAccess: [{ _forge: HookType.ACCESS }],
            onSubmission: [
              { _forge: HookType.SUBMIT, onValid: { next: [{ _forge: PolicyType.OUTCOME_REDIRECT, goto: '/done' }] } },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).not.toThrow()
    })

  })

  describe('tie-breaker scope', () => {
    const functionRegistry = new FunctionRegistry()
    const renderFunctionRegistry = new RenderFunctionRegistry()
    renderFunctionRegistry.registerMany([createTestComponent('text', () => '<input />')])

    const baseJourney: JourneyDefinition = {
      _forge: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should allow tie-breakers in step reachability', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            reachability: {
              tieBreakers: [{ _forge: PolicyType.NAVIGATION_TIE_BREAKER, priority: 1 }],
            },
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).not.toThrow()
    })

  })

  describe('structure scope', () => {
    const functionRegistry = new FunctionRegistry()
    const renderFunctionRegistry = new RenderFunctionRegistry()
    renderFunctionRegistry.registerMany([createTestComponent('text', () => '<input />')])

    const baseJourney: JourneyDefinition = {
      _forge: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should allow steps in journey steps arrays and journeys in children arrays', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [{ _forge: StructureType.STEP, path: '/step1', title: 'Step 1', blocks: [] } as StepDefinition],
        children: [
          {
            _forge: StructureType.JOURNEY,
            path: '/child',
            code: 'child',
            title: 'Child',
            steps: [{ _forge: StructureType.STEP, path: '/step2', title: 'Step 2', blocks: [] } as StepDefinition],
          },
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).not.toThrow()
    })

    it('should reject a step defined inside a block property', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
                content: { _forge: StructureType.STEP, path: '/stray', title: 'Stray' },
              } as unknown as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, renderFunctionRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeReferenceScopeError) => e.message === 'Steps can only be defined in a journey steps array',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })

    it('should reject a journey defined inside a block property', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
                content: { _forge: StructureType.JOURNEY, path: '/stray', code: 'stray', title: 'Stray' },
              } as unknown as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, renderFunctionRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeReferenceScopeError) =>
              e.message === 'Journeys can only be defined at the root or in a journey children array',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })
  })

  describe('block scope', () => {
    const functionRegistry = new FunctionRegistry()
    const renderFunctionRegistry = new RenderFunctionRegistry()
    renderFunctionRegistry.registerMany([
      createTestComponent('text', () => '<input />'),
      createTestComponent('wrapper', () => '<div />'),
    ])

    const baseJourney: JourneyDefinition = {
      _forge: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should allow blocks in step blocks arrays and nested within other blocks', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.BASIC,
                variant: 'wrapper',
                content: { _forge: ComponentCallType.BASIC, variant: 'text' },
              } as unknown as BlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).not.toThrow()
    })

    it('should reject a block defined inside journey metadata', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        metadata: {
          banner: { _forge: ComponentCallType.BASIC, variant: 'text' },
        },
        steps: [{ _forge: StructureType.STEP, path: '/step1', title: 'Step 1', blocks: [] } as StepDefinition],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, renderFunctionRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeReferenceScopeError) =>
              e.message === "Blocks can only be defined in a step's blocks structure or nested within another block",
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })
  })

  describe('container types', () => {
    const functionRegistry = new FunctionRegistry()
    functionRegistry.register({
      saveToApi: { name: 'saveToApi', evaluate: () => {} },
    })

    const renderFunctionRegistry = new RenderFunctionRegistry()
    renderFunctionRegistry.registerMany([createTestComponent('text', () => '<input />')])

    const baseJourney: JourneyDefinition = {
      _forge: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should allow correctly typed container entries', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'text',
                code: 'field1',
              } as FieldBlockDefinition,
            ],
            onAccess: [{ _forge: HookType.ACCESS }],
            onSubmission: [
              {
                _forge: HookType.SUBMIT,
                onValid: {
                  effects: [{ _forge: FunctionCallType.EFFECT, name: 'saveToApi', arguments: [] }],
                  next: [{ _forge: PolicyType.OUTCOME_REDIRECT, goto: '/done' }],
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, renderFunctionRegistry)).not.toThrow()
    })

  })

  describe('function arity', () => {
    const createArityRegistry = (): FunctionRegistry => {
      const conditions = new ConditionRegistry()
      conditions.register('exactOne', { argumentsSchema: z.tuple([z.number()]), factory: () => () => true })
      conditions.register('withRest', {
        argumentsSchema: z.tuple([z.number()]).rest(z.number()),
        factory: () => () => true,
      })
      conditions.register('trailingOptional', {
        argumentsSchema: z.tuple([z.number(), z.number().optional()]),
        factory: () => () => true,
      })
      conditions.register('noSchema', { factory: () => () => true })
      conditions.register('nonTuple', { argumentsSchema: z.number(), factory: () => () => true })

      const transformers = new TransformerRegistry()
      transformers.register('exactOneTransformer', {
        argumentsSchema: z.tuple([z.number()]),
        factory: () => (value: unknown) => value,
      })

      const registry = new FunctionRegistry()
      registry.register(conditions.build({}))
      registry.register(transformers.build({}))

      return registry
    }

    const renderFunctionRegistry = new RenderFunctionRegistry()
    renderFunctionRegistry.registerMany([
      createTestComponent('text', () => '<input />'),
      createTestComponent('collection-block', () => '<div />'),
    ])

    const baseJourney: JourneyDefinition = {
      _forge: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    const ref = (name: string): ReferenceExpr => ({ _forge: ExpressionType.REFERENCE, path: [name] })

    const conditionField = (code: string, conditionName: string, args: ReferenceExpr[]): FieldBlockDefinition =>
      ({
        _forge: ComponentCallType.FIELD,
        variant: 'text',
        code,
        validWhen: [
          {
            _forge: PolicyType.VALIDATION_RULE,
            message: 'Invalid',
            condition: {
              _forge: PredicateType.TEST,
              subject: { _forge: ExpressionType.REFERENCE, path: [code] },
              negate: false,
              condition: { _forge: FunctionCallType.CONDITION, name: conditionName, arguments: args },
            },
          },
        ],
      }) as FieldBlockDefinition

    const journeyWithField = (field: FieldBlockDefinition): JourneyDefinition => ({
      ...baseJourney,
      steps: [
        {
          _forge: StructureType.STEP,
          path: '/step1',
          title: 'Step 1',
          blocks: [field],
        } as StepDefinition,
      ],
    })

    it('should throw when an exact-arity function receives too few arguments', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey = journeyWithField(conditionField('field1', 'exactOne', []))

      // Act / Assert
      try {
        compileJourney(journey, registry, renderFunctionRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const arityErrors = error.errors.filter((e: Error) => e instanceof ForgeFunctionArityError)

          expect(arityErrors).toHaveLength(1)
          expect(arityErrors[0].functionName).toBe('exactOne')
          expect(arityErrors[0].expected).toBe('1')
          expect(arityErrors[0].received).toBe(0)
        }
      }
    })

    it('should throw when an exact-arity function receives too many arguments', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey = journeyWithField(conditionField('field1', 'exactOne', [ref('a'), ref('b')]))

      // Act / Assert
      try {
        compileJourney(journey, registry, renderFunctionRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const arityErrors = error.errors.filter((e: Error) => e instanceof ForgeFunctionArityError)

          expect(arityErrors).toHaveLength(1)
          expect(arityErrors[0].received).toBe(2)
        }
      }
    })

    it('should not throw when an exact-arity function receives exactly the right count', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey = journeyWithField(conditionField('field1', 'exactOne', [ref('a')]))

      // Act / Assert
      expect(() => compileJourney(journey, registry, renderFunctionRegistry)).not.toThrow()
    })

    it('should not throw when the entry has no argumentsSchema', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey = journeyWithField(conditionField('field1', 'noSchema', [ref('a'), ref('b'), ref('c')]))

      // Act / Assert
      expect(() => compileJourney(journey, registry, renderFunctionRegistry)).not.toThrow()
    })

    it('should not throw when the argumentsSchema is not a tuple', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey = journeyWithField(conditionField('field1', 'nonTuple', [ref('a'), ref('b')]))

      // Act / Assert
      expect(() => compileJourney(journey, registry, renderFunctionRegistry)).not.toThrow()
    })

    it('should throw when a tuple with rest receives fewer than the fixed items', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey = journeyWithField(conditionField('field1', 'withRest', []))

      // Act / Assert
      try {
        compileJourney(journey, registry, renderFunctionRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const arityErrors = error.errors.filter((e: Error) => e instanceof ForgeFunctionArityError)

          expect(arityErrors).toHaveLength(1)
          expect(arityErrors[0].expected).toBe('at least 1')
        }
      }
    })

    it('should not throw when a tuple with rest receives more than the fixed items', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey = journeyWithField(conditionField('field1', 'withRest', [ref('a'), ref('b'), ref('c')]))

      // Act / Assert
      expect(() => compileJourney(journey, registry, renderFunctionRegistry)).not.toThrow()
    })

    it('should not throw when a trailing optional item is omitted', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey = journeyWithField(conditionField('field1', 'trailingOptional', [ref('a')]))

      // Act / Assert
      expect(() => compileJourney(journey, registry, renderFunctionRegistry)).not.toThrow()
    })

    it('should throw when fewer than the required prefix is supplied to a trailing-optional tuple', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey = journeyWithField(conditionField('field1', 'trailingOptional', []))

      // Act / Assert
      try {
        compileJourney(journey, registry, renderFunctionRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const arityErrors = error.errors.filter((e: Error) => e instanceof ForgeFunctionArityError)

          expect(arityErrors).toHaveLength(1)
          expect(arityErrors[0].expected).toBe('between 1 and 2')
          expect(arityErrors[0].received).toBe(0)
        }
      }
    })

    it('should throw when a function inside an iterator yield template has the wrong arity', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.BASIC,
                variant: 'collection-block',
                collection: {
                  _forge: ExpressionType.ITERATE,
                  input: { _forge: ExpressionType.REFERENCE, path: ['data', 'items'] },
                  iterator: {
                    _forge: IteratorType.MAP,
                    yield: {
                      blocks: [
                        {
                          _forge: ComponentCallType.FIELD,
                          variant: 'text',
                          code: 'item',
                          defaultValue: {
                            _forge: FunctionCallType.TRANSFORMER,
                            name: 'exactOneTransformer',
                            arguments: [],
                          },
                        },
                      ],
                    },
                  },
                },
              } as BlockDefinition & Record<string, unknown>,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      try {
        compileJourney(journey, registry, renderFunctionRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const arityErrors = error.errors.filter((e: Error) => e instanceof ForgeFunctionArityError)

          expect(arityErrors).toHaveLength(1)
          expect(arityErrors[0].functionName).toBe('exactOneTransformer')
          expect(arityErrors[0].received).toBe(0)
        }
      }
    })

    it('should collect multiple arity violations in one aggregate error', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              conditionField('field1', 'exactOne', []),
              conditionField('field2', 'exactOne', [ref('a'), ref('b')]),
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      try {
        compileJourney(journey, registry, renderFunctionRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const arityErrors = error.errors.filter((e: Error) => e instanceof ForgeFunctionArityError)

          expect(arityErrors).toHaveLength(2)

          const receivedCounts = arityErrors.map((e: ForgeFunctionArityError) => e.received)
          expect(receivedCounts).toContain(0)
          expect(receivedCounts).toContain(2)
        }
      }
    })

    it('should populate error fields from the node source diagnostics', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey = journeyWithField(conditionField('field1', 'exactOne', []))

      // Act / Assert
      try {
        compileJourney(journey, registry, renderFunctionRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const arityError = error.errors.find(
            (e: Error) => e instanceof ForgeFunctionArityError,
          ) as ForgeFunctionArityError

          expect(arityError.functionName).toBe('exactOne')
          expect(arityError.functionType).toBe(FunctionCallType.CONDITION)
          expect(arityError.expected).toBe('1')
          expect(arityError.received).toBe(0)
          expect(arityError.formattedPath).toBeDefined()
        }
      }
    })
  })
})
