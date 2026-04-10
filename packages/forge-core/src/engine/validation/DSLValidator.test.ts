import {
  StructureType,
  TransitionType,
  OutcomeType,
  FunctionType,
  PredicateType,
  ExpressionType,
  BlockType,
} from '../../authoring/types/enums'
import type { JourneyDefinition, StepDefinition } from '../../authoring/types/structures.type'
import FunctionRegistry from '../FunctionRegistry'
import ComponentRegistry from '../../components/ComponentRegistry'
import { buildComponent } from '../../components/utils/buildComponent'
import FormConfigurationSerialisationError from '../errors/FormConfigurationSerialisationError'
import FormConfigurationSchemaError from '../errors/FormConfigurationSchemaError'
import UnregisteredFunctionError from '../errors/UnregisteredFunctionError'
import UnregisteredComponentError from '../errors/UnregisteredComponentError'
import { DSLValidator } from './DSLValidator'

describe('FormValidator', () => {
  describe('validateSchema', () => {
    it('should validate a valid schema', () => {
      const validJourney = {
        type: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
          } as StepDefinition,
        ],
      } as JourneyDefinition

      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should fail when type is missing with clear error path', () => {
      const invalidJourney = {
        // Missing type
        code: 'test-journey',
        title: 'Test Journey',
        steps: [],
      } as JourneyDefinition

      expect(() => DSLValidator.validateSchema(invalidJourney)).toThrow(AggregateError)

      try {
        DSLValidator.validateSchema(invalidJourney)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors.length).toBeGreaterThan(0)

          const typeError = error.errors.find(
            e => e instanceof FormConfigurationSchemaError && e.path?.includes('type'),
          )
          expect(typeError).toBeDefined()
          expect(typeError?.message).toContain('Invalid input')
        }
      }
    })

    it('should fail when required fields are missing', () => {
      const invalidJourney = {
        type: StructureType.JOURNEY,
        steps: [],
      } as JourneyDefinition

      expect(() => DSLValidator.validateSchema(invalidJourney)).toThrow(AggregateError)

      try {
        DSLValidator.validateSchema(invalidJourney)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors.length).toBeGreaterThan(0)
          expect(error.errors.some(e => e instanceof FormConfigurationSchemaError && e.path?.includes('code'))).toBe(
            true,
          )
          expect(error.errors.some(e => e instanceof FormConfigurationSchemaError && e.path?.includes('title'))).toBe(
            true,
          )
        }
      }
    })

    it('should catch multiple errors in a schema', () => {
      const brokenJson = {
        type: StructureType.JOURNEY,
        code: 'strengths_and_needs',
        title: 'Strengths and Needs Assessment',
        path: '/strength-and-needs',
        children: [
          {
            type: StructureType.JOURNEY,
            code: null,
            title: null,
            path: null,
            onAccess: [
              {
                type: TransitionType.ACCESS,
                next: [
                  {
                    type: OutcomeType.REDIRECT,
                    goto: '/unauthorized',
                  },
                ],
              },
            ],
            steps: [
              {
                type: StructureType.STEP,
                path: '/test',
                title: null,
                blocks: [],
                onSubmission: [
                  {
                    type: TransitionType.SUBMIT,
                    validate: true,
                    onValid: {
                      next: [
                        {
                          type: OutcomeType.REDIRECT,
                          goto: '/next',
                        },
                      ],
                    },
                    onInvalid: {
                      next: [
                        {
                          type: OutcomeType.REDIRECT,
                          goto: '@self',
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          } as JourneyDefinition,
        ],
      } as JourneyDefinition

      expect(() => DSLValidator.validateSchema(brokenJson)).toThrow(AggregateError)

      try {
        DSLValidator.validateSchema(brokenJson)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors.length).toBeGreaterThan(0)

          const codeError = error.errors.find(
            e => e instanceof FormConfigurationSchemaError && e.path?.join('.') === 'children.0.code',
          )
          expect(codeError).toBeDefined()

          const titleError = error.errors.find(
            e => e instanceof FormConfigurationSchemaError && e.path?.join('.') === 'children.0.title',
          )
          expect(titleError).toBeDefined()
        }
      }
    })
  })

  describe('validateJSON', () => {
    it('should not throw for valid JSON objects', () => {
      const validJSON = {
        type: 'journey',
        code: 'test',
        nested: {
          array: [1, 2, 3],
          string: 'hello',
          number: 42,
          boolean: true,
          null: null as any,
        },
      }

      expect(() => DSLValidator.validateJSON(validJSON)).not.toThrow()
    })

    it('should throw FormConfigurationSerialisationError for undefined input', () => {
      expect(() => DSLValidator.validateJSON(undefined)).toThrow(FormConfigurationSerialisationError)

      try {
        DSLValidator.validateJSON(undefined)
      } catch (error) {
        expect(error).toBeInstanceOf(FormConfigurationSerialisationError)
        if (error instanceof FormConfigurationSerialisationError) {
          expect(error.type).toBe('non_serializable')
          expect(error.message).toContain('undefined')
        }
      }
    })

    it('should throw AggregateError with multiple errors for objects with non-serializable types', () => {
      const invalidJSON = {
        func: () => {},
        date: new Date(),
        symbol: Symbol('test'),
        nested: {
          anotherFunc() {
            /* empty */
          },
        },
      }

      expect(() => DSLValidator.validateJSON(invalidJSON)).toThrow(AggregateError)

      try {
        DSLValidator.validateJSON(invalidJSON)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors.length).toBe(4) // func, date, symbol, anotherFunc
          expect(error.errors.every(e => e instanceof FormConfigurationSerialisationError)).toBe(true)
          expect(error.message).toContain('JSON validation failed')
        }
      }
    })

    it('should detect circular references', () => {
      const circularObject: any = {
        name: 'test',
        nested: {
          value: 123,
        },
      }
      circularObject.nested.parent = circularObject

      expect(() => DSLValidator.validateJSON(circularObject)).toThrow(FormConfigurationSerialisationError)

      try {
        DSLValidator.validateJSON(circularObject)
      } catch (error) {
        expect(error).toBeInstanceOf(FormConfigurationSerialisationError)
        if (error instanceof FormConfigurationSerialisationError) {
          expect(error.type).toBe('json_error')
          expect(error.message).toContain('Converting circular structure to JSON')
        }
      }
    })

    it('should handle deeply nested structures', () => {
      const deepObject: any = {
        level: 0,
      }
      let current = deepObject

      Array.from({ length: 150 }).forEach((_, i) => {
        current.nested = { level: i + 1 }
        current = current.nested
      })

      expect(() => DSLValidator.validateJSON(deepObject)).not.toThrow()
    })

    it('should throw AggregateError for BigInt values', () => {
      const objWithBigInt = {
        value: BigInt(123),
      }

      expect(() => DSLValidator.validateJSON(objWithBigInt)).toThrow(AggregateError)

      try {
        DSLValidator.validateJSON(objWithBigInt)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(1)
          const err = error.errors[0]
          expect(err).toBeInstanceOf(FormConfigurationSerialisationError)
          if (err instanceof FormConfigurationSerialisationError) {
            expect(err.type).toBe('BigInt')
          }
        }
      }
    })

    it('should throw AggregateError for non-plain objects', () => {
      class CustomClass {
        value = 123
      }

      const objWithClass = {
        custom: new CustomClass(),
      }

      expect(() => DSLValidator.validateJSON(objWithClass)).toThrow(AggregateError)

      try {
        DSLValidator.validateJSON(objWithClass)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(1)
          const err = error.errors[0]
          expect(err).toBeInstanceOf(FormConfigurationSerialisationError)
          if (err instanceof FormConfigurationSerialisationError) {
            expect(err.type).toContain('Non-plain object')
            expect(err.type).toContain('CustomClass')
          }
        }
      }
    })
  })

  describe('validateFunctions()', () => {
    const createRegistry = (...names: string[]): FunctionRegistry => {
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

    const baseJourney: JourneyDefinition = {
      type: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should not throw when journey has no function references', () => {
      // Arrange
      const registry = createRegistry()

      // Act / Assert
      expect(() => DSLValidator.validateFunctions(baseJourney, registry)).not.toThrow()
    })

    it('should not throw when all referenced functions are registered', () => {
      // Arrange
      const registry = createRegistry('isEqualTo', 'saveToApi')

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
                type: TransitionType.SUBMIT,
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
      expect(() => DSLValidator.validateFunctions(journey, registry)).not.toThrow()
    })

    it('should throw when an effect is not registered', () => {
      // Arrange
      const registry = createRegistry()

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
                type: TransitionType.SUBMIT,
                onValid: {
                  effects: [{ type: FunctionType.EFFECT, name: 'nonExistentEffect', arguments: [] }],
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => DSLValidator.validateFunctions(journey, registry)).toThrow(AggregateError)

      try {
        DSLValidator.validateFunctions(journey, registry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(1)
          expect(error.errors[0]).toBeInstanceOf(UnregisteredFunctionError)
          expect(error.errors[0].functionName).toBe('nonExistentEffect')
          expect(error.errors[0].functionType).toBe(FunctionType.EFFECT)
        }
      }
    })

    it('should throw when a condition is not registered', () => {
      // Arrange
      const registry = createRegistry()

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
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => DSLValidator.validateFunctions(journey, registry)).toThrow(AggregateError)

      try {
        DSLValidator.validateFunctions(journey, registry)
      } catch (error) {
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(1)
          expect(error.errors[0]).toBeInstanceOf(UnregisteredFunctionError)
          expect(error.errors[0].functionName).toBe('missingCondition')
          expect(error.errors[0].functionType).toBe(FunctionType.CONDITION)
        }
      }
    })

    it('should collect multiple unregistered function errors', () => {
      // Arrange
      const registry = createRegistry('registeredEffect')

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
                type: TransitionType.ACCESS,
                effects: [
                  { type: FunctionType.EFFECT, name: 'registeredEffect', arguments: [] },
                  { type: FunctionType.EFFECT, name: 'missingEffect1', arguments: [] },
                ],
              },
            ],
            onSubmission: [
              {
                type: TransitionType.SUBMIT,
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
        DSLValidator.validateFunctions(journey, registry)
        fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(2)

          const names = error.errors.map((e: UnregisteredFunctionError) => e.functionName)
          expect(names).toContain('missingEffect1')
          expect(names).toContain('missingEffect2')
        }
      }
    })

    it('should find unregistered functions in nested child journeys', () => {
      // Arrange
      const registry = createRegistry()

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
                    type: TransitionType.ACCESS,
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
        DSLValidator.validateFunctions(journey, registry)
        fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(1)
          expect(error.errors[0].functionName).toBe('deeplyNestedEffect')
        }
      }
    })

    it('should detect unregistered transformer and generator functions', () => {
      // Arrange
      const registry = createRegistry()

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
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      try {
        DSLValidator.validateFunctions(journey, registry)
        fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(2)

          const types = error.errors.map((e: UnregisteredFunctionError) => e.functionType)
          expect(types).toContain(FunctionType.GENERATOR)
          expect(types).toContain(FunctionType.TRANSFORMER)
        }
      }
    })

    it('should include the path to the unregistered function in the error', () => {
      // Arrange
      const registry = createRegistry()

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
                type: TransitionType.ACCESS,
                effects: [{ type: FunctionType.EFFECT, name: 'missingEffect', arguments: [] }],
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      try {
        DSLValidator.validateFunctions(journey, registry)
        fail('Expected AggregateError')
      } catch (error) {
        if (error instanceof AggregateError) {
          const err = error.errors[0] as UnregisteredFunctionError
          expect(err.path.join('.')).toContain('effects')
          expect(err.path.join('.')).toContain('0')
        }
      }
    })
  })

  describe('validateComponents()', () => {
    const createRegistry = (...variants: string[]): ComponentRegistry => {
      const registry = new ComponentRegistry()

      if (variants.length > 0) {
        registry.registerMany(variants.map(variant => buildComponent(variant, () => `<${variant} />`)))
      }

      return registry
    }

    const baseJourney: JourneyDefinition = {
      type: StructureType.JOURNEY,
      path: '/test',
      code: 'test',
      title: 'Test',
      steps: [],
    }

    it('should not throw when journey has no blocks', () => {
      // Arrange
      const registry = createRegistry()

      // Act / Assert
      expect(() => DSLValidator.validateComponents(baseJourney, registry)).not.toThrow()
    })

    it('should not throw when all block variants are registered', () => {
      // Arrange
      const registry = createRegistry('text', 'radio')

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
                blockType: BlockType.BASIC,
                variant: 'radio',
                code: 'field2',
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => DSLValidator.validateComponents(journey, registry)).not.toThrow()
    })

    it('should throw when a block variant is not registered', () => {
      // Arrange
      const registry = createRegistry()

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
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => DSLValidator.validateComponents(journey, registry)).toThrow(AggregateError)

      try {
        DSLValidator.validateComponents(journey, registry)
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
      const registry = createRegistry('text')

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
        DSLValidator.validateComponents(journey, registry)
        fail('Expected AggregateError')
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
      const registry = createRegistry()

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
                  },
                ],
              } as StepDefinition,
            ],
          },
        ],
      }

      // Act / Assert
      try {
        DSLValidator.validateComponents(journey, registry)
        fail('Expected AggregateError')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(1)
          expect(error.errors[0].variant).toBe('deeplyNestedComponent')
        }
      }
    })

    it('should include the path to the unregistered component in the error', () => {
      // Arrange
      const registry = createRegistry()

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
                variant: 'missingComponent',
                code: 'field1',
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      try {
        DSLValidator.validateComponents(journey, registry)
        fail('Expected AggregateError')
      } catch (error) {
        if (error instanceof AggregateError) {
          const err = error.errors[0] as UnregisteredComponentError
          expect(err.path.join('.')).toContain('blocks')
          expect(err.path.join('.')).toContain('0')
        }
      }
    })
  })
})
