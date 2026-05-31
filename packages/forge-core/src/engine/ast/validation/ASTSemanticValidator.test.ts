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
import type { JourneyDefinition, StepDefinition, ValidationExpr } from '../../../authoring/types/structures.type'
import type { FieldBlockDefinition, BlockDefinition } from '../../../components/types/structures.type'
import FunctionRegistry from '../../registries/FunctionRegistry'
import ComponentRegistry from '../../registries/ComponentRegistry'
import { buildComponent } from '../../../components/utils/buildComponent'
import ForgeConfigurationReferenceScopeError from '../../errors/ForgeConfigurationReferenceScopeError'
import UnregisteredFunctionError from '../../errors/UnregisteredFunctionError'
import UnregisteredComponentError from '../../errors/UnregisteredComponentError'
import JourneyCompiler from '../../JourneyCompiler'

function compileJourney(
  journey: JourneyDefinition,
  functionRegistry: FunctionRegistry,
  componentRegistry: ComponentRegistry,
): void {
  const compiler = new JourneyCompiler({ functionRegistry, componentRegistry })

  compiler.compile(journey)
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

    const createRequiredValidation = (subject: ReferenceExpr): ValidationExpr => ({
      type: ExpressionType.VALIDATION,
      message: 'Required',
      condition: {
        type: PredicateType.TEST,
        negate: false,
        subject,
        condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] },
      },
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
  })
})
