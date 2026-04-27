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
import type { ReferenceExpr } from '../../authoring/types/expressions.type'
import type { JourneyDefinition, StepDefinition, ValidationExpr } from '../../authoring/types/structures.type'
import type { BlockDefinition, FieldBlockDefinition } from '../../components/types/structures.type'
import FunctionRegistry from '../registries/FunctionRegistry'
import ComponentRegistry from '../registries/ComponentRegistry'
import { buildComponent } from '../../components/utils/buildComponent'
import FormConfigurationSerialisationError from '../errors/FormConfigurationSerialisationError'
import FormConfigurationSchemaError from '../errors/FormConfigurationSchemaError'
import FormConfigurationReferenceScopeError from '../errors/FormConfigurationReferenceScopeError'
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
            e => e instanceof FormConfigurationSchemaError && e.path?.includes('type'),
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
              e instanceof FormConfigurationSchemaError && e.path?.join('.') === 'steps.0.blocks.0.validWhen.0.message',
          )

          expect(schemaError).toBeInstanceOf(FormConfigurationSchemaError)
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

  describe('validateTree() - reference scopes', () => {
    type RawBasicBlockDefinition = BlockDefinition & Record<string, unknown>
    type RawFieldBlockDefinition = FieldBlockDefinition & Record<string, unknown>

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

    it('should allow Self references anywhere inside a field block except the field code expression', () => {
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
                label: { text: createReference(['answers', '@self']) },
                defaultValue: createReference(['answers', '@self']),
                validWhen: [createRequiredValidation(createReference(['answers', '@self']))],
              }),
            ],
          } as StepDefinition,
        ],
      })

      // Act / Assert
      expect(() => DSLValidator.validateTree(journey, functionRegistry, componentRegistry)).not.toThrow()
    })

    it('should reject Self references outside field blocks with a formatted DSL path', () => {
      // Arrange
      const journey = createBaseJourney({
        steps: [
          {
            type: StructureType.STEP,
            path: '/confirm',
            title: 'Confirm',
            blocks: [],
            validWhen: [createRequiredValidation(createReference(['answers', '@self']))],
          } as StepDefinition,
        ],
      })

      // Act / Assert
      expect(() => DSLValidator.validateTree(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        DSLValidator.validateTree(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeError = error.errors[0]

          expect(scopeError).toBeInstanceOf(FormConfigurationReferenceScopeError)
          expect(scopeError.code).toBe('self_outside_field')
          expect(scopeError.toString()).toContain(
            'Path=travel-declaration > confirm > validWhen[0] > condition > subject',
          )
        }
      }
    })

    it('should reject Self references inside field code expressions', () => {
      // Arrange
      const journey = createBaseJourney({
        steps: [
          {
            type: StructureType.STEP,
            path: '/personal-details',
            title: 'Personal details',
            blocks: [
              createFieldBlock({
                code: createReference(['answers', '@self']),
              }),
            ],
          } as StepDefinition,
        ],
      })

      // Act / Assert
      expect(() => DSLValidator.validateTree(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        DSLValidator.validateTree(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeError = error.errors[0]

          expect(scopeError).toBeInstanceOf(FormConfigurationReferenceScopeError)
          expect(scopeError.code).toBe('self_inside_code')
          expect(scopeError.toString()).toContain(
            'Path=travel-declaration > personal-details > blocks[0] (GovUKInput) > code',
          )
        }
      }
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
      expect(() => DSLValidator.validateTree(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        DSLValidator.validateTree(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeError = error.errors[0]

          expect(scopeError).toBeInstanceOf(FormConfigurationReferenceScopeError)
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
      expect(() => DSLValidator.validateTree(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        DSLValidator.validateTree(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeError = error.errors[0]

          expect(scopeError).toBeInstanceOf(FormConfigurationReferenceScopeError)
          expect(scopeError.code).toBe('item_outside_iterator_scope')
          expect(scopeError.toString()).toContain(
            'Path=travel-declaration > trips > blocks[0] (collection-block) > collection > source > iterator > template > blocks[0] (GovUKInput - country) > defaultValue',
          )
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
      expect(() => DSLValidator.validateTree(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        DSLValidator.validateTree(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeError = error.errors[0]

          expect(scopeError).toBeInstanceOf(FormConfigurationReferenceScopeError)
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
      expect(() => DSLValidator.validateTree(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        DSLValidator.validateTree(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const codes = error.errors.map(scopeError => scopeError.code)

          expect(error.errors).toHaveLength(2)
          expect(codes).toEqual(['item_invalid_level', 'loop_outside_iterator_scope'])
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
      expect(() => DSLValidator.validateTree(journey, functionRegistry, componentRegistry)).not.toThrow()
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

  describe('validateTree() - function registration', () => {
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
      expect(() => DSLValidator.validateTree(baseJourney, registry, compRegistry)).not.toThrow()
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
      expect(() => DSLValidator.validateTree(journey, registry, compRegistry)).not.toThrow()
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
      expect(() => DSLValidator.validateTree(journey, registry, compRegistry)).toThrow(AggregateError)

      try {
        DSLValidator.validateTree(journey, registry, compRegistry)
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
      expect(() => DSLValidator.validateTree(journey, registry, compRegistry)).toThrow(AggregateError)

      try {
        DSLValidator.validateTree(journey, registry, compRegistry)
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
        DSLValidator.validateTree(journey, registry, compRegistry)
        expect.fail('Expected AggregateError')
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
        DSLValidator.validateTree(journey, registry, compRegistry)
        expect.fail('Expected AggregateError')
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
        DSLValidator.validateTree(journey, registry, compRegistry)
        expect.fail('Expected AggregateError')
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
      const registry = createFnRegistry()

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
                effects: [{ type: FunctionType.EFFECT, name: 'missingEffect', arguments: [] }],
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      try {
        DSLValidator.validateTree(journey, registry, compRegistry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        if (error instanceof AggregateError) {
          const err = error.errors[0] as UnregisteredFunctionError
          expect(err.path.join('.')).toContain('effects')
          expect(err.path.join('.')).toContain('0')
        }
      }
    })

    it('should render unregistered function errors with a formatted DSL path', () => {
      // Arrange
      const registry = createFnRegistry()

      const journey: JourneyDefinition = {
        ...baseJourney,
        code: 'travel-declaration',
        path: '/travel-declaration',
        steps: [
          {
            type: StructureType.STEP,
            path: '/personal-details',
            title: 'Personal details',
            blocks: [],
            onSubmission: [
              {
                type: HookType.SUBMIT,
                onValid: {
                  effects: [{ type: FunctionType.EFFECT, name: 'saveAnswers', arguments: [] }],
                },
              },
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => DSLValidator.validateTree(journey, registry, compRegistry)).toThrow(AggregateError)

      try {
        DSLValidator.validateTree(journey, registry, compRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const functionError = error.errors[0] as UnregisteredFunctionError

          expect(functionError.toString()).toContain(
            'Path=travel-declaration > personal-details > onSubmission[0] > onValid > effects[0] (effect - saveAnswers)',
          )
        }
      }
    })
  })

  describe('validateTree() - component registration', () => {
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
      expect(() => DSLValidator.validateTree(baseJourney, fnRegistry, registry)).not.toThrow()
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
      expect(() => DSLValidator.validateTree(journey, fnRegistry, registry)).not.toThrow()
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
      expect(() => DSLValidator.validateTree(journey, fnRegistry, registry)).toThrow(AggregateError)

      try {
        DSLValidator.validateTree(journey, fnRegistry, registry)
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
        DSLValidator.validateTree(journey, fnRegistry, registry)
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
        DSLValidator.validateTree(journey, fnRegistry, registry)
        expect.fail('Expected AggregateError')
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
                variant: 'missingComponent',
                code: 'field1',
              } as FieldBlockDefinition,
            ],
          } as StepDefinition,
        ],
      }

      // Act / Assert
      try {
        DSLValidator.validateTree(journey, fnRegistry, registry)
        expect.fail('Expected AggregateError')
      } catch (error) {
        if (error instanceof AggregateError) {
          const err = error.errors[0] as UnregisteredComponentError
          expect(err.path.join('.')).toContain('blocks')
          expect(err.path.join('.')).toContain('0')
        }
      }
    })
  })

  describe('validateTree() - effect scope', () => {
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
      expect(() => DSLValidator.validateTree(journey, functionRegistry, componentRegistry)).not.toThrow()
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
      expect(() => DSLValidator.validateTree(journey, functionRegistry, componentRegistry)).not.toThrow()
    })

    it('should reject effects outside hooks', () => {
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
              entryWhen: {
                effects: [{ type: FunctionType.EFFECT, name: 'saveToApi', arguments: [] }],
              },
            },
          } as unknown as StepDefinition,
        ],
      }

      // Act / Assert
      expect(() => DSLValidator.validateTree(journey, functionRegistry, componentRegistry)).toThrow(AggregateError)

      try {
        DSLValidator.validateTree(journey, functionRegistry, componentRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const scopeError = error.errors.find(
            (e: FormConfigurationReferenceScopeError) => e.code === 'effect_outside_hook',
          )

          expect(scopeError).toBeDefined()
          expect(scopeError?.message).toContain('saveToApi')
          expect(scopeError?.message).toContain('only be used inside a hook')
        }
      }
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
      expect(() => DSLValidator.validateTree(journey, functionRegistry, componentRegistry)).not.toThrow()
    })
  })
})
