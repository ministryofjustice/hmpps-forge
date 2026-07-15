import {
  StructureType,
  HookType,
  OutcomeType,
  FunctionType,
  PredicateType,
  ExpressionType,
  BlockType,
  IteratorType,
} from '../../authoring/types/enums'
import type { JourneyDefinition, StepDefinition } from '../../authoring/types/structures.type'
import type { FieldBlockDefinition } from '../../components/types/structures.type'
import ForgeConfigurationSerialisationError from '../errors/ForgeConfigurationSerialisationError'
import ForgeConfigurationSchemaError from '../errors/ForgeConfigurationSchemaError'
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

    it('should validate journey unreachable redirect targets', () => {
      // Arrange
      const validJourney = {
        type: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        reachability: {
          unreachableRedirect: 'frontier',
        },
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
          } as StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should accept journey resumeWhen when set to true', () => {
      // Arrange
      const validJourney = {
        type: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        reachability: {
          resumeWhen: true,
        },
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
          } as StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should accept journey resumeWhen when set to false', () => {
      // Arrange
      const validJourney = {
        type: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        reachability: {
          resumeWhen: false,
        },
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
          } as StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should accept journey resumeWhen when set to a predicate expression', () => {
      // Arrange
      const validJourney = {
        type: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        reachability: {
          resumeWhen: {
            type: PredicateType.TEST,
            negate: false,
            subject: { type: ExpressionType.REFERENCE, path: ['query', 'resume'] },
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['true'] },
          },
        },
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
          } as StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should accept journey resumeWhen when set to a non-predicate expression', () => {
      // Arrange
      const validJourney = {
        type: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        reachability: {
          resumeWhen: { type: ExpressionType.REFERENCE, path: ['data', 'resumeActive'] },
        },
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
          } as StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should reject journey resumeWhen when set to an invalid value', () => {
      // Arrange
      const invalidJourney = {
        type: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        reachability: {
          resumeWhen: 'always',
        },
        steps: [],
      } as unknown as JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(invalidJourney)).toThrow(AggregateError)
    })

    it('should validate static data with ordinary nested type fields', () => {
      // Arrange
      const validJourney = {
        type: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        data: {
          service: {
            type: 'static-service',
            enabled: true,
          },
        },
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            data: {
              values: [{ type: 'static-value', label: 'Allowed' }],
            },
            blocks: [],
          },
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should validate dynamic route metadata schema', () => {
      // Arrange
      const validJourney = {
        type: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: { type: ExpressionType.REFERENCE, path: ['data', 'journeyTitle'] },
        description: { type: ExpressionType.REFERENCE, path: ['data', 'journeyDescription'] },
        metadata: {
          hiddenFromNav: { type: ExpressionType.REFERENCE, path: ['data', 'hideJourney'] },
          navGroup: {
            type: FunctionType.GENERATOR,
            name: 'Format',
            arguments: ['Group %1', { type: ExpressionType.REFERENCE, path: ['params', 'groupId'] }],
          },
        },
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: { type: ExpressionType.REFERENCE, path: ['data', 'stepTitle'] },
            description: { type: ExpressionType.REFERENCE, path: ['data', 'stepDescription'] },
            metadata: {
              hiddenFromNav: { type: ExpressionType.REFERENCE, path: ['data', 'hideStep'] },
              navigation: {
                label: { type: ExpressionType.REFERENCE, path: ['data', 'stepNavLabel'] },
              },
            },
            blocks: [],
          },
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should reject Forge expressions in nested static data', () => {
      // Arrange
      const invalidJourney = {
        type: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            data: {
              values: [
                {
                  label: 'Disallowed',
                  value: {
                    type: ExpressionType.REFERENCE,
                    path: ['request', 'user'],
                  },
                },
              ],
            },
            blocks: [],
          },
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(invalidJourney)).toThrow(AggregateError)

      try {
        DSLValidator.validateSchema(invalidJourney)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const dataError = error.errors.find(
            e => e instanceof ForgeConfigurationSchemaError && e.path?.join('.') === 'steps.0.data.values.0.value',
          )

          expect(dataError).toBeInstanceOf(ForgeConfigurationSchemaError)
          expect(dataError?.message).toContain('Forge expressions are not supported in static data')
        }
      }
    })

    it('should reject invalid journey unreachable redirect targets', () => {
      // Arrange
      const invalidJourney = {
        type: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        reachability: {
          unreachableRedirect: 'start',
        },
        steps: [],
      } as unknown as JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(invalidJourney)).toThrow(AggregateError)
    })

    it('should validate grouped validation and validateOnEntry schema', () => {
      const postcodeBlock = {
        type: StructureType.BLOCK,
        blockType: BlockType.FIELD,
        variant: 'TextInput',
        code: 'postcode',
        validWhen: [
          {
            type: ExpressionType.VALIDATION,
            groups: ['address'],
            condition: {
              type: PredicateType.TEST,
              negate: false,
              subject: { type: ExpressionType.REFERENCE, path: ['answers', 'postcode'] },
              condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] },
            },
            message: 'Enter your postcode',
          },
        ],
      } satisfies FieldBlockDefinition

      const validJourney = {
        type: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            type: StructureType.STEP,
            path: '/review',
            title: 'Review',
            validateOnEntry: [
              { groups: ['contact'], when: true },
              {
                groups: ['address'],
                when: {
                  type: PredicateType.TEST,
                  negate: false,
                  subject: { type: ExpressionType.REFERENCE, path: ['data', 'addressLoaded'] },
                  condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: [true] },
                },
              },
            ],
            blocks: [postcodeBlock],
            onSubmission: [
              {
                type: HookType.SUBMIT,
                validate: { groups: ['contact', 'address'] },
              },
            ],
          },
        ],
      } as JourneyDefinition

      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should validate field validWhen supplied by an iterator', () => {
      const block = {
        type: StructureType.BLOCK,
        blockType: BlockType.FIELD,
        variant: 'TextInput',
        code: 'status',
        validWhen: {
          type: ExpressionType.ITERATE,
          input: { type: ExpressionType.REFERENCE, path: ['data', 'checks'] },
          iterator: {
            type: IteratorType.MAP,
            yield: {
              type: ExpressionType.VALIDATION,
              condition: {
                type: PredicateType.TEST,
                negate: false,
                subject: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'enabled'] },
                condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: [true] },
              },
              message: 'Check must be enabled',
            },
          },
        },
      } satisfies FieldBlockDefinition

      const validJourney = {
        type: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            type: StructureType.STEP,
            path: '/review',
            title: 'Review',
            blocks: [block],
          },
        ],
      } satisfies JourneyDefinition

      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should fail when type is missing with clear error path', () => {
      const invalidJourney = {
        // Missing type
        code: 'test-journey',
        title: 'Test Journey',
        steps: [],
      } as unknown as JourneyDefinition

      expect(() => DSLValidator.validateSchema(invalidJourney)).toThrow(AggregateError)

      try {
        DSLValidator.validateSchema(invalidJourney)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors.length).toBeGreaterThan(0)

          const typeError = error.errors.find(
            e => e instanceof ForgeConfigurationSchemaError && e.path?.includes('type'),
          )
          expect(typeError).toBeDefined()
          expect(typeError?.message).toContain('Invalid input')
        }
      }
    })

    it('should render schema errors with a formatted DSL path', () => {
      // Arrange
      const invalidJourney = {
        type: StructureType.JOURNEY,
        path: '/travel-declaration',
        code: 'travel-declaration',
        title: 'Travel Declaration',
        steps: [
          {
            type: StructureType.STEP,
            path: '/personal-details',
            title: 'Personal details',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'GovUKInput',
                code: 'firstName',
                validWhen: [
                  {
                    type: ExpressionType.VALIDATION,
                    message: null,
                    condition: {
                      type: PredicateType.TEST,
                      negate: false,
                      subject: { type: ExpressionType.REFERENCE, path: ['answers', 'firstName'] },
                      condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] },
                    },
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(invalidJourney)).toThrow(AggregateError)

      try {
        DSLValidator.validateSchema(invalidJourney)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const schemaError = error.errors.find(
            e =>
              e instanceof ForgeConfigurationSchemaError &&
              e.path?.join('.') === 'steps.0.blocks.0.validWhen.0.message',
          )

          expect(schemaError).toBeInstanceOf(ForgeConfigurationSchemaError)
          expect(schemaError?.toString()).toContain(
            'Path=travel-declaration > personal-details > blocks[0] (GovUKInput - firstName) > validWhen[0] > message',
          )
        }
      }
    })

    it('should fail when required fields are missing', () => {
      const invalidJourney = {
        type: StructureType.JOURNEY,
        steps: [],
      } as unknown as JourneyDefinition

      expect(() => DSLValidator.validateSchema(invalidJourney)).toThrow(AggregateError)

      try {
        DSLValidator.validateSchema(invalidJourney)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors.length).toBeGreaterThan(0)
          expect(error.errors.some(e => e instanceof ForgeConfigurationSchemaError && e.path?.includes('code'))).toBe(
            true,
          )
          expect(error.errors.some(e => e instanceof ForgeConfigurationSchemaError && e.path?.includes('title'))).toBe(
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
                type: HookType.ACCESS,
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
                    type: HookType.SUBMIT,
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
          } as unknown as JourneyDefinition,
        ],
      } as unknown as JourneyDefinition

      expect(() => DSLValidator.validateSchema(brokenJson)).toThrow(AggregateError)

      try {
        DSLValidator.validateSchema(brokenJson)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors.length).toBeGreaterThan(0)

          const codeError = error.errors.find(
            e => e instanceof ForgeConfigurationSchemaError && e.path?.join('.') === 'children.0.code',
          )
          expect(codeError).toBeDefined()

          const titleError = error.errors.find(
            e => e instanceof ForgeConfigurationSchemaError && e.path?.join('.') === 'children.0.title',
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
        steps: [{ type: 'step', path: '/test', title: 'Test' }],
      }

      expect(() => DSLValidator.validateJSON(validJSON)).not.toThrow()
    })

    it('should throw ForgeConfigurationSerialisationError when input is undefined', () => {
      expect(() => DSLValidator.validateJSON(undefined)).toThrow(ForgeConfigurationSerialisationError)
    })

    it('should throw AggregateError for objects containing functions', () => {
      const objWithFunction = {
        type: 'journey',
        func: () => 'hello',
      }

      expect(() => DSLValidator.validateJSON(objWithFunction)).toThrow(AggregateError)

      try {
        DSLValidator.validateJSON(objWithFunction)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(1)
          const err = error.errors[0]
          expect(err).toBeInstanceOf(ForgeConfigurationSerialisationError)
          if (err instanceof ForgeConfigurationSerialisationError) {
            expect(err.type).toBe('Function')
          }
        }
      }
    })

    it('should throw AggregateError for objects containing Date instances', () => {
      const objWithDate = {
        type: 'journey',
        created: new Date('2024-01-01'),
      }

      expect(() => DSLValidator.validateJSON(objWithDate)).toThrow(AggregateError)

      try {
        DSLValidator.validateJSON(objWithDate)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(1)
          const err = error.errors[0]
          expect(err).toBeInstanceOf(ForgeConfigurationSerialisationError)
          if (err instanceof ForgeConfigurationSerialisationError) {
            expect(err.type).toBe('Date object')
          }
        }
      }
    })

    it('should throw AggregateError for objects containing Symbols', () => {
      const objWithSymbol = {
        type: 'journey',
        sym: Symbol('test'),
      }

      expect(() => DSLValidator.validateJSON(objWithSymbol)).toThrow(AggregateError)

      try {
        DSLValidator.validateJSON(objWithSymbol)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(1)
          const err = error.errors[0]
          expect(err).toBeInstanceOf(ForgeConfigurationSerialisationError)
          if (err instanceof ForgeConfigurationSerialisationError) {
            expect(err.type).toBe('Symbol')
          }
        }
      }
    })

    it('should throw ForgeConfigurationSerialisationError for circular references', () => {
      const circularObject: any = {
        type: 'journey',
        nested: {
          value: 123,
        },
      }
      circularObject.nested.parent = circularObject

      expect(() => DSLValidator.validateJSON(circularObject)).toThrow(ForgeConfigurationSerialisationError)

      try {
        DSLValidator.validateJSON(circularObject)
      } catch (error) {
        expect(error).toBeInstanceOf(ForgeConfigurationSerialisationError)
        if (error instanceof ForgeConfigurationSerialisationError) {
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
          expect(err).toBeInstanceOf(ForgeConfigurationSerialisationError)
          if (err instanceof ForgeConfigurationSerialisationError) {
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
          expect(err).toBeInstanceOf(ForgeConfigurationSerialisationError)
          if (err instanceof ForgeConfigurationSerialisationError) {
            expect(err.type).toContain('Non-plain object')
            expect(err.type).toContain('CustomClass')
          }
        }
      }
    })
  })
})
