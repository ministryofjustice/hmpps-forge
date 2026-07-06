import { z } from 'zod'
import {
  StructureType,
  HookType,
  OutcomeType,
  FunctionType,
  PredicateType,
  ExpressionType,
  BlockType,
  IteratorType,
} from '../../../authoring/types/enums'
import type { ReferenceExpr } from '../../../authoring/types/expressions.type'
import type { JourneyDefinition, StepDefinition } from '../../../authoring/types/structures.type'
import type { FieldBlockDefinition, BlockDefinition } from '../../../components/types/structures.type'
import FunctionRegistry from '../../registries/FunctionRegistry'
import ComponentRegistry from '../../registries/ComponentRegistry'
import ConditionRegistry from '../../../authoring/registries/ConditionRegistry'
import TransformerRegistry from '../../../authoring/registries/TransformerRegistry'
import { buildComponent } from '../../../components/utils/buildComponent'
import ForgeConfigurationReferenceScopeError from '../../errors/ForgeConfigurationReferenceScopeError'
import UnregisteredFunctionError from '../../errors/UnregisteredFunctionError'
import UnregisteredComponentError from '../../errors/UnregisteredComponentError'
import FunctionArityError from '../../errors/FunctionArityError'
import CompilationPipeline from '../CompilationPipeline'

function compileJourney(
  journey: JourneyDefinition,
  functionRegistry: FunctionRegistry,
  componentRegistry: ComponentRegistry,
): void {
  const pipeline = new CompilationPipeline({ functionRegistry, componentRegistry })

  pipeline.compile(journey)
}

describe('ASTSemanticValidator', () => {
  describe('reference scopes', () => {
    const functionRegistry = new FunctionRegistry()
    functionRegistry.register({
      IsRequired: { name: 'IsRequired', evaluate: () => true, isAsync: false },
    })

    const componentRegistry = new ComponentRegistry()
    componentRegistry.registerMany([
      buildComponent('GovUKInput', () => '<input />'),
      buildComponent('collection-block', () => '<div />'),
    ])

    const createBaseJourney = (overrides: Partial<JourneyDefinition> = {}): JourneyDefinition => ({
      type: StructureType.JOURNEY,
      path: '/travel-declaration',
      code: 'travel-declaration',
      title: 'Travel Declaration',
      steps: [],
      ...overrides,
    })

    const createReference = (path: string[]): ReferenceExpr => ({
      type: ExpressionType.REFERENCE,
      path,
    })

    type RawBasicBlockDefinition = BlockDefinition & Record<string, unknown>
    type RawFieldBlockDefinition = FieldBlockDefinition & Record<string, unknown>

    const createBasicBlock = (
      properties: Partial<BlockDefinition> & Record<string, unknown>,
    ): RawBasicBlockDefinition => ({
      type: StructureType.BLOCK,
      blockType: BlockType.BASIC,
      variant: 'collection-block',
      ...properties,
    })

    const createFieldBlock = (
      properties: Pick<FieldBlockDefinition, 'code'> & Partial<FieldBlockDefinition> & Record<string, unknown>,
    ): RawFieldBlockDefinition => ({
      type: StructureType.BLOCK,
      blockType: BlockType.FIELD,
      variant: 'GovUKInput',
      ...properties,
    })

    it('should reject Item references outside iterators', () => {
      // Arrange
      const journey = createBaseJourney({
        steps: [
          {
            type: StructureType.STEP,
            path: '/personal-details',
            title: 'Personal details',
            blocks: [
              createFieldBlock({
                code: 'firstName',
                defaultValue: createReference(['@scope', '0', 'firstName']),
              }),
            ],
          } as StepDefinition,
        ],
      })

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeError = error.errors[0]

          expect(scopeError).toBeInstanceOf(ForgeConfigurationReferenceScopeError)
          expect(scopeError.code).toBe('item_outside_iterator_scope')
        }
      }
    })

    it('should reject parent Item references when there is no parent iterator', () => {
      // Arrange
      const journey = createBaseJourney({
        steps: [
          {
            type: StructureType.STEP,
            path: '/trips',
            title: 'Trips',
            blocks: [
              createBasicBlock({
                collection: {
                  type: ExpressionType.ITERATE,
                  input: createReference(['answers', 'trips']),
                  iterator: {
                    type: IteratorType.MAP,
                    yield: {
                      blocks: [
                        {
                          type: StructureType.BLOCK,
                          blockType: BlockType.FIELD,
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
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeError = error.errors[0]

          expect(scopeError).toBeInstanceOf(ForgeConfigurationReferenceScopeError)
          expect(scopeError.code).toBe('item_outside_iterator_scope')
        }
      }
    })

    it('should reject invalid Loop properties inside iterators', () => {
      // Arrange
      const journey = createBaseJourney({
        steps: [
          {
            type: StructureType.STEP,
            path: '/trips',
            title: 'Trips',
            blocks: [
              createBasicBlock({
                collection: {
                  type: ExpressionType.ITERATE,
                  input: createReference(['answers', 'trips']),
                  iterator: {
                    type: IteratorType.MAP,
                    yield: {
                      blocks: [
                        {
                          type: StructureType.BLOCK,
                          blockType: BlockType.FIELD,
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
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeError = error.errors[0]

          expect(scopeError).toBeInstanceOf(ForgeConfigurationReferenceScopeError)
          expect(scopeError.code).toBe('loop_invalid_property')
        }
      }
    })

    it('should collect multiple reference scope errors', () => {
      // Arrange
      const journey = createBaseJourney({
        steps: [
          {
            type: StructureType.STEP,
            path: '/personal-details',
            title: 'Personal details',
            blocks: [
              createFieldBlock({
                code: 'firstName',
                defaultValue: createReference(['@scope', 'banana', 'firstName']),
                label: { text: createReference(['@loop', '0', 'index0']) },
              }),
            ],
          } as StepDefinition,
        ],
      })

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const codes = error.errors.map((scopeError: ForgeConfigurationReferenceScopeError) => scopeError.code)

          expect(error.errors).toHaveLength(2)
          expect(codes).toContain('item_invalid_level')
          expect(codes).toContain('loop_outside_iterator_scope')
        }
      }
    })

    it('should allow Item and Loop parent references inside nested iterators', () => {
      // Arrange
      const journey = createBaseJourney({
        steps: [
          {
            type: StructureType.STEP,
            path: '/teams',
            title: 'Teams',
            blocks: [
              createBasicBlock({
                collection: {
                  type: ExpressionType.ITERATE,
                  input: createReference(['data', 'teams']),
                  iterator: {
                    type: IteratorType.MAP,
                    yield: {
                      collection: {
                        type: ExpressionType.ITERATE,
                        input: createReference(['@scope', '0', 'members']),
                        iterator: {
                          type: IteratorType.MAP,
                          yield: {
                            blocks: [
                              {
                                type: StructureType.BLOCK,
                                blockType: BlockType.FIELD,
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
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).not.toThrow()
    })
  })

  describe('function registration', () => {
    const createFnRegistry = (...names: string[]): FunctionRegistry => {
      const registry = new FunctionRegistry()

      if (names.length > 0) {
        const entries: Record<string, { name: string; evaluate: () => void; isAsync: boolean }> = {}

        names.forEach(name => {
          entries[name] = { name, evaluate: () => {}, isAsync: false }
        })

        registry.register(entries)
      }

      return registry
    }

    const compRegistry = new ComponentRegistry()
    compRegistry.registerMany([buildComponent('text', () => '<input />'), buildComponent('radio', () => '<radio />')])

    const baseJourney: JourneyDefinition = {
      type: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should not throw when journey has no function references', () => {
      // Arrange
      const registry = createFnRegistry()

      // Act / Assert
      expect(() => compileJourney(baseJourney, registry, compRegistry)).not.toThrow()
    })

    it('should not throw when all referenced functions are registered', () => {
      // Arrange
      const registry = createFnRegistry('isEqualTo', 'saveToApi')

      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onSubmission: [
              {
                type: HookType.SUBMIT,
                validate: true,
                onValid: {
                  effects: [{ type: FunctionType.EFFECT, name: 'saveToApi', arguments: [] }],
                  next: [{ type: OutcomeType.REDIRECT, goto: '/next' }],
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, registry, compRegistry)).not.toThrow()
    })

    it('should throw when an effect is not registered', () => {
      // Arrange
      const registry = createFnRegistry()

      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onSubmission: [
              {
                type: HookType.SUBMIT,
                onValid: {
                  effects: [{ type: FunctionType.EFFECT, name: 'nonExistentEffect', arguments: [] }],
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, registry, compRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, registry, compRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const fnErrors = error.errors.filter((e: Error) => e instanceof UnregisteredFunctionError)

          expect(fnErrors).toHaveLength(1)
          expect(fnErrors[0].functionName).toBe('nonExistentEffect')
          expect(fnErrors[0].functionType).toBe(FunctionType.EFFECT)
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
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                validWhen: [
                  {
                    type: ExpressionType.VALIDATION,
                    message: 'Required',
                    condition: {
                      type: PredicateType.TEST,
                      subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
                      negate: false,
                      condition: { type: FunctionType.CONDITION, name: 'missingCondition', arguments: [] },
                    },
                  },
                ],
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, registry, compRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, registry, compRegistry)
      } catch (error) {
        if (error instanceof AggregateError) {
          const fnErrors = error.errors.filter((e: Error) => e instanceof UnregisteredFunctionError)

          expect(fnErrors).toHaveLength(1)
          expect(fnErrors[0].functionName).toBe('missingCondition')
          expect(fnErrors[0].functionType).toBe(FunctionType.CONDITION)
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
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onAccess: [
              {
                type: HookType.ACCESS,
                effects: [
                  { type: FunctionType.EFFECT, name: 'registeredEffect', arguments: [] },
                  { type: FunctionType.EFFECT, name: 'missingEffect1', arguments: [] },
                ],
              },
            ],
            onSubmission: [
              {
                type: HookType.SUBMIT,
                onValid: {
                  effects: [{ type: FunctionType.EFFECT, name: 'missingEffect2', arguments: [] }],
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      try {
        compileJourney(journey, registry, compRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const fnErrors = error.errors.filter((e: Error) => e instanceof UnregisteredFunctionError)

          expect(fnErrors).toHaveLength(2)

          const names = fnErrors.map((e: UnregisteredFunctionError) => e.functionName)
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
            type: StructureType.JOURNEY,
            path: '/child',
            code: 'child',
            title: 'Child',
            steps: [
              {
                type: StructureType.STEP,
                path: '/nested-step',
                title: 'Nested',
                blocks: [],
                onAccess: [
                  {
                    type: HookType.ACCESS,
                    effects: [{ type: FunctionType.EFFECT, name: 'deeplyNestedEffect', arguments: [] }],
                  },
                ],
              } as StepDefinition,
            ],
          },
        ],
      }

      // Act / Assert
      try {
        compileJourney(journey, registry, compRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const fnErrors = error.errors.filter((e: Error) => e instanceof UnregisteredFunctionError)

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
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: { type: FunctionType.GENERATOR, name: 'missingGenerator', arguments: [] },
                formatters: [{ type: FunctionType.TRANSFORMER, name: 'missingTransformer', arguments: [] }],
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      try {
        compileJourney(journey, registry, compRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const fnErrors = error.errors.filter((e: Error) => e instanceof UnregisteredFunctionError)

          expect(fnErrors).toHaveLength(2)

          const types = fnErrors.map((e: UnregisteredFunctionError) => e.functionType)
          expect(types).toContain(FunctionType.GENERATOR)
          expect(types).toContain(FunctionType.TRANSFORMER)
        }
      }
    })
  })

  describe('component registration', () => {
    const createCompRegistry = (...variants: string[]): ComponentRegistry => {
      const registry = new ComponentRegistry()

      if (variants.length > 0) {
        registry.registerMany(variants.map(variant => buildComponent(variant, () => `<${variant} />`)))
      }

      return registry
    }

    const fnRegistry = new FunctionRegistry()

    const baseJourney: JourneyDefinition = {
      type: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should not throw when journey has no blocks', () => {
      // Arrange
      const registry = createCompRegistry()

      // Act / Assert
      expect(() => compileJourney(baseJourney, fnRegistry, registry)).not.toThrow()
    })

    it('should not throw when all block variants are registered', () => {
      // Arrange
      const registry = createCompRegistry('text', 'radio')

      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
              } as FieldBlockDefinition,
              {
                type: StructureType.BLOCK,
                blockType: BlockType.BASIC,
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
      const registry = createCompRegistry()

      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
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
          expect(error.errors[0]).toBeInstanceOf(UnregisteredComponentError)
          expect(error.errors[0].variant).toBe('nonExistentComponent')
        }
      }
    })

    it('should collect multiple unregistered component errors', () => {
      // Arrange
      const registry = createCompRegistry('text')

      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
              },
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'missingRadio',
                code: 'field2',
              },
              {
                type: StructureType.BLOCK,
                blockType: BlockType.BASIC,
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

          const variants = error.errors.map((e: UnregisteredComponentError) => e.variant)
          expect(variants).toContain('missingRadio')
          expect(variants).toContain('missingCheckbox')
        }
      }
    })

    it('should find unregistered components in nested child journeys', () => {
      // Arrange
      const registry = createCompRegistry()

      const journey: JourneyDefinition = {
        ...baseJourney,
        children: [
          {
            type: StructureType.JOURNEY,
            path: '/child',
            code: 'child',
            title: 'Child',
            steps: [
              {
                type: StructureType.STEP,
                path: '/nested-step',
                title: 'Nested',
                blocks: [
                  {
                    type: StructureType.BLOCK,
                    blockType: BlockType.FIELD,
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
      saveToApi: { name: 'saveToApi', evaluate: () => {}, isAsync: false },
      loadData: { name: 'loadData', evaluate: () => {}, isAsync: false },
      IsRequired: { name: 'IsRequired', evaluate: () => true, isAsync: false },
    })

    const componentRegistry = new ComponentRegistry()
    componentRegistry.registerMany([buildComponent('text', () => '<input />')])

    const baseJourney: JourneyDefinition = {
      type: StructureType.JOURNEY,
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
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onAccess: [
              {
                type: HookType.ACCESS,
                effects: [{ type: FunctionType.EFFECT, name: 'loadData', arguments: [] }],
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).not.toThrow()
    })

    it('should allow effects inside submit hooks', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onSubmission: [
              {
                type: HookType.SUBMIT,
                onValid: {
                  effects: [{ type: FunctionType.EFFECT, name: 'saveToApi', arguments: [] }],
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).not.toThrow()
    })

    it('should not reject non-effect functions outside hooks', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                validWhen: [
                  {
                    type: ExpressionType.VALIDATION,
                    message: 'Required',
                    condition: {
                      type: PredicateType.TEST,
                      subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
                      negate: false,
                      condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] },
                    },
                  },
                ],
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).not.toThrow()
    })

    it('should reject an effect outside a hook', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: { type: FunctionType.EFFECT, name: 'saveToApi', arguments: [] },
              } as unknown as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'effect_outside_hook',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })

    it('should reject an effect inside an iterator template outside a hook', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: {
                  type: ExpressionType.ITERATE,
                  input: { type: ExpressionType.REFERENCE, path: ['answers', 'items'] },
                  iterator: {
                    type: IteratorType.MAP,
                    yield: { type: FunctionType.EFFECT, name: 'saveToApi', arguments: [] },
                  },
                },
              } as unknown as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'effect_outside_hook',
          )

          expect(scopeErrors.length).toBeGreaterThanOrEqual(1)
        }
      }
    })
  })

  describe('function argument scope', () => {
    const functionRegistry = new FunctionRegistry()
    functionRegistry.register({
      someTransformer: { name: 'someTransformer', evaluate: () => 'value', isAsync: false },
      someCondition: { name: 'someCondition', evaluate: () => true, isAsync: false },
      IsRequired: { name: 'IsRequired', evaluate: () => true, isAsync: false },
    })

    const componentRegistry = new ComponentRegistry()
    componentRegistry.registerMany([
      buildComponent('text', () => '<input />'),
      buildComponent('collection-block', () => '<div />'),
    ])

    const baseJourney: JourneyDefinition = {
      type: StructureType.JOURNEY,
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
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: {
                  type: FunctionType.TRANSFORMER,
                  name: 'someTransformer',
                  arguments: [
                    {
                      type: StructureType.BLOCK,
                      blockType: BlockType.BASIC,
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
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'block_in_function_arguments',
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
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: {
                  type: FunctionType.TRANSFORMER,
                  name: 'someTransformer',
                  arguments: [
                    {
                      type: ExpressionType.VALIDATION,
                      message: 'Required',
                      condition: {
                        type: PredicateType.TEST,
                        subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
                        negate: false,
                        condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] },
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
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'validation_outside_valid_when',
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
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: {
                  type: FunctionType.TRANSFORMER,
                  name: 'someTransformer',
                  arguments: [{ type: ExpressionType.REFERENCE, path: ['answers', 'name'] }],
                },
                validWhen: [
                  {
                    type: ExpressionType.VALIDATION,
                    message: 'Required',
                    condition: {
                      type: PredicateType.TEST,
                      subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
                      negate: false,
                      condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] },
                    },
                  },
                ],
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).not.toThrow()
    })

    it('should collect multiple function argument scope errors', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: {
                  type: FunctionType.TRANSFORMER,
                  name: 'someTransformer',
                  arguments: [
                    {
                      type: StructureType.BLOCK,
                      blockType: BlockType.BASIC,
                      variant: 'text',
                    },
                    {
                      type: ExpressionType.VALIDATION,
                      message: 'Required',
                      condition: {
                        type: PredicateType.TEST,
                        subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
                        negate: false,
                        condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] },
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
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const codes = error.errors
            .filter((e: Error) => e instanceof ForgeConfigurationReferenceScopeError)
            .map((e: ForgeConfigurationReferenceScopeError) => e.code)

          expect(codes).toContain('block_in_function_arguments')
          expect(codes).toContain('validation_outside_valid_when')
        }
      }
    })

    it('should reject blocks inside function arguments in iterator templates', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.BASIC,
                variant: 'collection-block',
                collection: {
                  type: ExpressionType.ITERATE,
                  input: { type: ExpressionType.REFERENCE, path: ['data', 'items'] },
                  iterator: {
                    type: IteratorType.MAP,
                    yield: {
                      blocks: [
                        {
                          type: StructureType.BLOCK,
                          blockType: BlockType.FIELD,
                          variant: 'text',
                          code: 'item',
                          defaultValue: {
                            type: FunctionType.TRANSFORMER,
                            name: 'someTransformer',
                            arguments: [
                              {
                                type: StructureType.BLOCK,
                                blockType: BlockType.BASIC,
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
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'block_in_function_arguments',
          )

          expect(scopeErrors.length).toBeGreaterThanOrEqual(1)
        }
      }
    })
  })

  describe('validation scope', () => {
    const functionRegistry = new FunctionRegistry()
    functionRegistry.register({
      IsRequired: { name: 'IsRequired', evaluate: () => true, isAsync: false },
      someTransformer: { name: 'someTransformer', evaluate: () => 'value', isAsync: false },
    })

    const componentRegistry = new ComponentRegistry()
    componentRegistry.registerMany([
      buildComponent('text', () => '<input />'),
      buildComponent('collection-block', () => '<div />'),
    ])

    const baseJourney: JourneyDefinition = {
      type: StructureType.JOURNEY,
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
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                validWhen: [
                  {
                    type: ExpressionType.VALIDATION,
                    message: 'Required',
                    condition: {
                      type: PredicateType.TEST,
                      subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
                      negate: false,
                      condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] },
                    },
                  },
                ],
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).not.toThrow()
    })

    it('should allow validations in step validWhen', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            validWhen: [
              {
                type: ExpressionType.VALIDATION,
                message: 'Step is not valid',
                condition: {
                  type: PredicateType.TEST,
                  subject: { type: ExpressionType.REFERENCE, path: ['answers', 'name'] },
                  negate: false,
                  condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] },
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).not.toThrow()
    })

    it('should reject a validation in a field block defaultValue', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: {
                  type: ExpressionType.VALIDATION,
                  message: 'Misplaced',
                  condition: {
                    type: PredicateType.TEST,
                    subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
                    negate: false,
                    condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] },
                  },
                },
              } as unknown as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'validation_outside_valid_when',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })

    it('should reject a validation in a basic block property', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.BASIC,
                variant: 'text',
                content: {
                  type: ExpressionType.VALIDATION,
                  message: 'Misplaced',
                  condition: {
                    type: PredicateType.TEST,
                    subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
                    negate: false,
                    condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] },
                  },
                },
              } as BlockDefinition & Record<string, unknown>,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'validation_outside_valid_when',
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
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: {
                  type: FunctionType.TRANSFORMER,
                  name: 'someTransformer',
                  arguments: [{ type: ExpressionType.REFERENCE, path: ['answers', 'name'] }],
                },
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).not.toThrow()
    })

    it('should allow validations inside iterator yield templates when the iterator is in validWhen', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                validWhen: [
                  {
                    type: ExpressionType.ITERATE,
                    input: {
                      type: ExpressionType.ITERATE,
                      input: { type: ExpressionType.REFERENCE, path: ['answers', 'goals'] },
                      iterator: {
                        type: IteratorType.FILTER,
                        predicate: {
                          type: PredicateType.TEST,
                          subject: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'status'] },
                          negate: false,
                          condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] },
                        },
                      },
                    },
                    iterator: {
                      type: IteratorType.MAP,
                      yield: {
                        type: ExpressionType.VALIDATION,
                        message: 'Must have steps',
                        condition: {
                          type: PredicateType.TEST,
                          subject: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'steps'] },
                          negate: false,
                          condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] },
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
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).not.toThrow()
    })
  })

  describe('outcome scope', () => {
    const functionRegistry = new FunctionRegistry()
    functionRegistry.register({
      saveToApi: { name: 'saveToApi', evaluate: () => {}, isAsync: false },
    })

    const componentRegistry = new ComponentRegistry()
    componentRegistry.registerMany([buildComponent('text', () => '<input />')])

    const baseJourney: JourneyDefinition = {
      type: StructureType.JOURNEY,
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
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onSubmission: [
              {
                type: HookType.SUBMIT,
                onValid: {
                  effects: [{ type: FunctionType.EFFECT, name: 'saveToApi', arguments: [] }],
                  next: [{ type: OutcomeType.REDIRECT, goto: '/next' }],
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).not.toThrow()
    })

    it('should reject an outcome outside a hook', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: { type: OutcomeType.REDIRECT, goto: '/somewhere' },
              } as unknown as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'outcome_outside_hook',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })
  })

  describe('hook scope', () => {
    const functionRegistry = new FunctionRegistry()
    const componentRegistry = new ComponentRegistry()
    componentRegistry.registerMany([buildComponent('text', () => '<input />')])

    const baseJourney: JourneyDefinition = {
      type: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should allow hooks on steps and journeys', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        onAccess: [{ type: HookType.ACCESS, next: [{ type: OutcomeType.REDIRECT, goto: '/login' }] }],
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onAccess: [{ type: HookType.ACCESS }],
            onSubmission: [
              { type: HookType.SUBMIT, onValid: { next: [{ type: OutcomeType.REDIRECT, goto: '/done' }] } },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).not.toThrow()
    })

    it('should reject a hook inside a block property', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: { type: HookType.ACCESS },
              } as unknown as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'hook_outside_step_or_journey',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })
  })

  describe('tie-breaker scope', () => {
    const functionRegistry = new FunctionRegistry()
    const componentRegistry = new ComponentRegistry()
    componentRegistry.registerMany([buildComponent('text', () => '<input />')])

    const baseJourney: JourneyDefinition = {
      type: StructureType.JOURNEY,
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
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            reachability: {
              tieBreakers: [{ type: ExpressionType.TIE_BREAKER, priority: 1 }],
            },
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).not.toThrow()
    })

    it('should reject a tie-breaker in a block property', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                defaultValue: { type: ExpressionType.TIE_BREAKER, priority: 1 },
              } as unknown as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'tiebreaker_outside_step_reachability',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })
  })

  describe('structure scope', () => {
    const functionRegistry = new FunctionRegistry()
    const componentRegistry = new ComponentRegistry()
    componentRegistry.registerMany([buildComponent('text', () => '<input />')])

    const baseJourney: JourneyDefinition = {
      type: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should allow steps in journey steps arrays and journeys in children arrays', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [{ type: StructureType.STEP, path: '/step1', title: 'Step 1', blocks: [] } as StepDefinition],
        children: [
          {
            type: StructureType.JOURNEY,
            path: '/child',
            code: 'child',
            title: 'Child',
            steps: [{ type: StructureType.STEP, path: '/step2', title: 'Step 2', blocks: [] } as StepDefinition],
          },
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).not.toThrow()
    })

    it('should reject a step defined inside a block property', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                content: { type: StructureType.STEP, path: '/stray', title: 'Stray' },
              } as unknown as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'step_outside_journey_steps',
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
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
                content: { type: StructureType.JOURNEY, path: '/stray', code: 'stray', title: 'Stray' },
              } as unknown as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'journey_outside_journey_children',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })
  })

  describe('block scope', () => {
    const functionRegistry = new FunctionRegistry()
    const componentRegistry = new ComponentRegistry()
    componentRegistry.registerMany([
      buildComponent('text', () => '<input />'),
      buildComponent('wrapper', () => '<div />'),
    ])

    const baseJourney: JourneyDefinition = {
      type: StructureType.JOURNEY,
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
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.BASIC,
                variant: 'wrapper',
                content: { type: StructureType.BLOCK, blockType: BlockType.BASIC, variant: 'text' },
              } as unknown as BlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).not.toThrow()
    })

    it('should reject a block defined inside journey metadata', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        metadata: {
          banner: { type: StructureType.BLOCK, blockType: BlockType.BASIC, variant: 'text' },
        },
        steps: [{ type: StructureType.STEP, path: '/step1', title: 'Step 1', blocks: [] } as StepDefinition],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'block_outside_blocks',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })
  })

  describe('container types', () => {
    const functionRegistry = new FunctionRegistry()
    functionRegistry.register({
      saveToApi: { name: 'saveToApi', evaluate: () => {}, isAsync: false },
    })

    const componentRegistry = new ComponentRegistry()
    componentRegistry.registerMany([buildComponent('text', () => '<input />')])

    const baseJourney: JourneyDefinition = {
      type: StructureType.JOURNEY,
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
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'text',
                code: 'field1',
              } as FieldBlockDefinition,
            ],
            onAccess: [{ type: HookType.ACCESS }],
            onSubmission: [
              {
                type: HookType.SUBMIT,
                onValid: {
                  effects: [{ type: FunctionType.EFFECT, name: 'saveToApi', arguments: [] }],
                  next: [{ type: OutcomeType.REDIRECT, goto: '/done' }],
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).not.toThrow()
    })

    it('should reject a non-hook in onAccess', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onAccess: [{ type: StructureType.BLOCK, blockType: BlockType.BASIC, variant: 'text' }],
          } as unknown as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'invalid_entry_in_on_access',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })

    it('should reject a non-effect in effects', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onAccess: [
              {
                type: HookType.ACCESS,
                effects: [{ type: ExpressionType.REFERENCE, path: ['data'] }],
              },
            ],
          } as unknown as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'invalid_entry_in_effects',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })

    it('should reject a non-outcome in next', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            onSubmission: [
              {
                type: HookType.SUBMIT,
                onValid: {
                  effects: [{ type: FunctionType.EFFECT, name: 'saveToApi', arguments: [] }],
                  next: [{ type: FunctionType.EFFECT, name: 'saveToApi', arguments: [] }],
                },
              },
            ],
          } as unknown as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'invalid_entry_in_next',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })

    it('should reject a non-block in blocks', () => {
      // Arrange
      const journey: JourneyDefinition = {
        ...baseJourney,
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [{ type: ExpressionType.REFERENCE, path: ['data', 'name'] }],
          } as unknown as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => compileJourney(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        compileJourney(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeErrors = error.errors.filter(
            (e: ForgeConfigurationReferenceScopeError) => e.code === 'invalid_entry_in_blocks',
          )

          expect(scopeErrors).toHaveLength(1)
        }
      }
    })
  })

  describe('function arity', () => {
    const createArityRegistry = (): FunctionRegistry => {
      const conditions = new ConditionRegistry()
      conditions.register('exactOne', { argumentsSchema: z.tuple([z.number()]) }, () => () => true)
      conditions.register('withRest', { argumentsSchema: z.tuple([z.number()]).rest(z.number()) }, () => () => true)
      conditions.register(
        'trailingOptional',
        { argumentsSchema: z.tuple([z.number(), z.number().optional()]) },
        () => () => true,
      )
      conditions.register('noSchema', {}, () => () => true)
      conditions.register('nonTuple', { argumentsSchema: z.number() }, () => () => true)

      const transformers = new TransformerRegistry()
      transformers.register(
        'exactOneTransformer',
        { argumentsSchema: z.tuple([z.number()]) },
        () => (value: unknown) => value,
      )

      const registry = new FunctionRegistry()
      registry.register(conditions.build({}))
      registry.register(transformers.build({}))

      return registry
    }

    const componentRegistry = new ComponentRegistry()
    componentRegistry.registerMany([
      buildComponent('text', () => '<input />'),
      buildComponent('collection-block', () => '<div />'),
    ])

    const baseJourney: JourneyDefinition = {
      type: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    const ref = (name: string): ReferenceExpr => ({ type: ExpressionType.REFERENCE, path: [name] })

    const conditionField = (code: string, conditionName: string, args: ReferenceExpr[]): FieldBlockDefinition =>
      ({
        type: StructureType.BLOCK,
        blockType: BlockType.FIELD,
        variant: 'text',
        code,
        validWhen: [
          {
            type: ExpressionType.VALIDATION,
            message: 'Invalid',
            condition: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: [code] },
              negate: false,
              condition: { type: FunctionType.CONDITION, name: conditionName, arguments: args },
            },
          },
        ],
      }) as FieldBlockDefinition

    const journeyWithField = (field: FieldBlockDefinition): JourneyDefinition => ({
      ...baseJourney,
      steps: [
        {
          type: StructureType.STEP,
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
        compileJourney(journey, registry, componentRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const arityErrors = error.errors.filter((e: Error) => e instanceof FunctionArityError)

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
        compileJourney(journey, registry, componentRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const arityErrors = error.errors.filter((e: Error) => e instanceof FunctionArityError)

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
      expect(() => compileJourney(journey, registry, componentRegistry)).not.toThrow()
    })

    it('should not throw when the entry has no argumentsSchema', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey = journeyWithField(conditionField('field1', 'noSchema', [ref('a'), ref('b'), ref('c')]))

      // Act / Assert
      expect(() => compileJourney(journey, registry, componentRegistry)).not.toThrow()
    })

    it('should not throw when the argumentsSchema is not a tuple', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey = journeyWithField(conditionField('field1', 'nonTuple', [ref('a'), ref('b')]))

      // Act / Assert
      expect(() => compileJourney(journey, registry, componentRegistry)).not.toThrow()
    })

    it('should throw when a tuple with rest receives fewer than the fixed items', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey = journeyWithField(conditionField('field1', 'withRest', []))

      // Act / Assert
      try {
        compileJourney(journey, registry, componentRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const arityErrors = error.errors.filter((e: Error) => e instanceof FunctionArityError)

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
      expect(() => compileJourney(journey, registry, componentRegistry)).not.toThrow()
    })

    it('should not throw when a trailing optional item is omitted', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey = journeyWithField(conditionField('field1', 'trailingOptional', [ref('a')]))

      // Act / Assert
      expect(() => compileJourney(journey, registry, componentRegistry)).not.toThrow()
    })

    it('should throw when fewer than the required prefix is supplied to a trailing-optional tuple', () => {
      // Arrange
      const registry = createArityRegistry()
      const journey = journeyWithField(conditionField('field1', 'trailingOptional', []))

      // Act / Assert
      try {
        compileJourney(journey, registry, componentRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const arityErrors = error.errors.filter((e: Error) => e instanceof FunctionArityError)

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
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.BASIC,
                variant: 'collection-block',
                collection: {
                  type: ExpressionType.ITERATE,
                  input: { type: ExpressionType.REFERENCE, path: ['data', 'items'] },
                  iterator: {
                    type: IteratorType.MAP,
                    yield: {
                      blocks: [
                        {
                          type: StructureType.BLOCK,
                          blockType: BlockType.FIELD,
                          variant: 'text',
                          code: 'item',
                          defaultValue: {
                            type: FunctionType.TRANSFORMER,
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
        compileJourney(journey, registry, componentRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const arityErrors = error.errors.filter((e: Error) => e instanceof FunctionArityError)

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
            type: StructureType.STEP,
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
        compileJourney(journey, registry, componentRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const arityErrors = error.errors.filter((e: Error) => e instanceof FunctionArityError)

          expect(arityErrors).toHaveLength(2)

          const receivedCounts = arityErrors.map((e: FunctionArityError) => e.received)
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
        compileJourney(journey, registry, componentRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const arityError = error.errors.find((e: Error) => e instanceof FunctionArityError) as FunctionArityError

          expect(arityError.functionName).toBe('exactOne')
          expect(arityError.functionType).toBe(FunctionType.CONDITION)
          expect(arityError.expected).toBe('1')
          expect(arityError.received).toBe(0)
          expect(arityError.formattedPath).toBeDefined()
        }
      }
    })
  })
})
