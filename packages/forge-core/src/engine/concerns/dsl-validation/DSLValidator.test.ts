import {
  StructureType,
  HookType,
  PolicyType,
  FunctionCallType,
  PredicateType,
  ExpressionType,
  ComponentCallType,
  IteratorType,
} from '../../../authoring/types/enums'
import type { JourneyDefinition, StepDefinition } from '../../../authoring/types/structures.type'
import type { FieldBlockDefinition, ResolvableBoolean } from '../../../components/types/structures.type'
import ForgeSerialisationError from '../../errors/ForgeSerialisationError'
import ForgeSchemaError from '../../errors/ForgeSchemaError'
import { DSLValidator } from './DSLValidator'

describe('FormValidator', () => {
  describe('validateSchema', () => {
    it('should validate a valid schema', () => {
      const validJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
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
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        reachability: {
          unreachableRedirect: 'frontier',
        },
        steps: [
          {
            _forge: StructureType.STEP,
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
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        reachability: {
          resumeWhen: true,
        },
        steps: [
          {
            _forge: StructureType.STEP,
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
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        reachability: {
          resumeWhen: false,
        },
        steps: [
          {
            _forge: StructureType.STEP,
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
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        reachability: {
          resumeWhen: {
            _forge: PredicateType.TEST,
            negate: false,
            subject: { _forge: ExpressionType.REFERENCE, path: ['query', 'resume'] },
            condition: { _forge: FunctionCallType.CONDITION, name: 'Equals', arguments: ['true'] },
          },
        },
        steps: [
          {
            _forge: StructureType.STEP,
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
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        reachability: {
          resumeWhen: {
            _forge: ExpressionType.REFERENCE,
            path: ['data', 'resumeActive'],
          } as unknown as ResolvableBoolean,
        },
        steps: [
          {
            _forge: StructureType.STEP,
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
        _forge: StructureType.JOURNEY,
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

    it('should accept block visibleWhen when set to a non-predicate expression', () => {
      // Arrange
      const validJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.BASIC,
                variant: 'GovUKPanel',
                visibleWhen: {
                  _forge: ExpressionType.REFERENCE,
                  path: ['data', 'showBlock'],
                } as unknown as ResolvableBoolean,
              },
            ],
          } as StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should reject block visibleWhen when set to an invalid value', () => {
      // Arrange
      const invalidJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [
              {
                _forge: ComponentCallType.BASIC,
                variant: 'GovUKPanel',
                visibleWhen: 'yes',
              },
            ],
          },
        ],
      } as unknown as JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(invalidJourney)).toThrow(AggregateError)
    })

    it('should accept step entryWhen when set to true', () => {
      // Arrange
      const validJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            reachability: {
              entryWhen: true,
            },
          } as StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should accept step entryWhen when set to false', () => {
      // Arrange
      const validJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            reachability: {
              entryWhen: false,
            },
          } as StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should accept step entryWhen when set to a predicate expression', () => {
      // Arrange
      const validJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            reachability: {
              entryWhen: {
                _forge: PredicateType.TEST,
                negate: false,
                subject: { _forge: ExpressionType.REFERENCE, path: ['session', 'submitted'] },
                condition: { _forge: FunctionCallType.CONDITION, name: 'Equals', arguments: ['true'] },
              },
            },
          } as StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should accept step entryWhen when set to a non-predicate expression', () => {
      // Arrange
      const validJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            reachability: {
              entryWhen: {
                _forge: ExpressionType.REFERENCE,
                path: ['data', 'entryActive'],
              } as unknown as ResolvableBoolean,
            },
          } as StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should reject step entryWhen when set to an invalid value', () => {
      // Arrange
      const invalidJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            reachability: {
              entryWhen: 'always',
            },
          },
        ],
      } as unknown as JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(invalidJourney)).toThrow(AggregateError)
    })

    it('should accept step validateOnEntry when set to true', () => {
      // Arrange
      const validJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            validateOnEntry: [{ groups: ['personal-details'], when: true }],
          } as StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should accept step validateOnEntry when set to false', () => {
      // Arrange
      const validJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            validateOnEntry: [{ groups: ['personal-details'], when: false }],
          } as StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should accept step validateOnEntry when set to a predicate expression', () => {
      // Arrange
      const validJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            validateOnEntry: [
              {
                groups: ['personal-details'],
                when: {
                  _forge: PredicateType.TEST,
                  negate: false,
                  subject: { _forge: ExpressionType.REFERENCE, path: ['session', 'submitted'] },
                  condition: { _forge: FunctionCallType.CONDITION, name: 'Equals', arguments: ['true'] },
                },
              },
            ],
          } as StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should accept step validateOnEntry when set to a non-predicate expression', () => {
      // Arrange
      const validJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            validateOnEntry: [
              {
                groups: ['personal-details'],
                when: {
                  _forge: ExpressionType.REFERENCE,
                  path: ['data', 'entryValidation'],
                } as unknown as ResolvableBoolean,
              },
            ],
          } as StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should reject step validateOnEntry when set to an invalid value', () => {
      // Arrange
      const invalidJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            blocks: [],
            validateOnEntry: [{ groups: ['personal-details'], when: 'always' }],
          },
        ],
      } as unknown as JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(invalidJourney)).toThrow(AggregateError)
    })

    it('should validate static data with ordinary nested type fields', () => {
      // Arrange
      const validJourney = {
        _forge: StructureType.JOURNEY,
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
            _forge: StructureType.STEP,
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
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: { _forge: ExpressionType.REFERENCE, path: ['data', 'journeyTitle'] },
        description: { _forge: ExpressionType.REFERENCE, path: ['data', 'journeyDescription'] },
        metadata: {
          hiddenFromNav: { _forge: ExpressionType.REFERENCE, path: ['data', 'hideJourney'] },
          navGroup: {
            _forge: FunctionCallType.GENERATOR,
            name: 'Format',
            arguments: ['Group %1', { _forge: ExpressionType.REFERENCE, path: ['params', 'groupId'] }],
          },
        },
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: { _forge: ExpressionType.REFERENCE, path: ['data', 'stepTitle'] },
            description: { _forge: ExpressionType.REFERENCE, path: ['data', 'stepDescription'] },
            metadata: {
              hiddenFromNav: { _forge: ExpressionType.REFERENCE, path: ['data', 'hideStep'] },
              navigation: {
                label: { _forge: ExpressionType.REFERENCE, path: ['data', 'stepNavLabel'] },
              },
            },
            blocks: [],
          },
        ],
      } as unknown as JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should reject Forge expressions in nested static data', () => {
      // Arrange
      const invalidJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/step1',
            title: 'Step 1',
            data: {
              values: [
                {
                  label: 'Disallowed',
                  value: {
                    _forge: ExpressionType.REFERENCE,
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
            e => e instanceof ForgeSchemaError && e.formattedPath === 'test-journey > step1 > data > values[0] > value',
          )

          expect(dataError).toBeInstanceOf(ForgeSchemaError)
          expect(dataError?.message).toContain('Forge expressions are not supported in static data')
        }
      }
    })

    it('should reject invalid journey unreachable redirect targets', () => {
      // Arrange
      const invalidJourney = {
        _forge: StructureType.JOURNEY,
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
        _forge: ComponentCallType.FIELD,
        variant: 'TextInput',
        code: 'postcode',
        validWhen: [
          {
            _forge: PolicyType.VALIDATION_RULE,
            groups: ['address'],
            condition: {
              _forge: PredicateType.TEST,
              negate: false,
              subject: { _forge: ExpressionType.REFERENCE, path: ['answers', 'postcode'] },
              condition: { _forge: FunctionCallType.CONDITION, name: 'IsRequired', arguments: [] },
            },
            message: 'Enter your postcode',
          },
        ],
      } satisfies FieldBlockDefinition

      const validJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/review',
            title: 'Review',
            validateOnEntry: [
              { groups: ['contact'], when: true },
              {
                groups: ['address'],
                when: {
                  _forge: PredicateType.TEST,
                  negate: false,
                  subject: { _forge: ExpressionType.REFERENCE, path: ['data', 'addressLoaded'] },
                  condition: { _forge: FunctionCallType.CONDITION, name: 'Equals', arguments: [true] },
                },
              },
            ],
            blocks: [postcodeBlock],
            onSubmission: [
              {
                _forge: HookType.SUBMIT,
                validate: { groups: ['contact', 'address'] },
              },
            ],
          },
        ],
      } as JourneyDefinition

      expect(() => DSLValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should validate generator-backed field and step validation', () => {
      // Arrange
      const fieldValidation = {
        _forge: PolicyType.VALIDATION_RULE,
        function: {
          _forge: FunctionCallType.GENERATOR,
          name: 'ValidateField',
          arguments: [{ _forge: ExpressionType.REFERENCE, path: ['@self'] }],
        },
      }
      const stepValidation = {
        _forge: PolicyType.VALIDATION_RULE,
        groups: ['review'],
        submissionOnly: true,
        function: {
          _forge: FunctionCallType.GENERATOR,
          name: 'ValidateStep',
          arguments: [{ _forge: ExpressionType.REFERENCE, path: ['answers', 'postcode'] }],
        },
      }
      const validJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/review',
            title: 'Review',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'TextInput',
                code: 'postcode',
                validWhen: [fieldValidation],
              } as FieldBlockDefinition,
            ],
            validWhen: [stepValidation],
          },
        ],
      } as JourneyDefinition

      // Act
      const validate = () => DSLValidator.validateSchema(validJourney)

      // Assert
      expect(validate).not.toThrow()
    })

    it.each([
      {
        name: 'both condition and function',
        rule: {
          _forge: PolicyType.VALIDATION_RULE,
          condition: {
            _forge: PredicateType.TEST,
            negate: false,
            subject: { _forge: ExpressionType.REFERENCE, path: ['answers', 'postcode'] },
            condition: { _forge: FunctionCallType.CONDITION, name: 'IsRequired', arguments: [] },
          },
          message: 'Enter a postcode',
          function: { _forge: FunctionCallType.GENERATOR, name: 'ValidatePostcode', arguments: [] },
        },
      },
      { name: 'neither condition nor function', rule: { _forge: PolicyType.VALIDATION_RULE } },
      {
        name: 'a condition function in the function property',
        rule: {
          _forge: PolicyType.VALIDATION_RULE,
          function: { _forge: FunctionCallType.CONDITION, name: 'ValidatePostcode', arguments: [] },
        },
      },
      {
        name: 'a transformer in the function property',
        rule: {
          _forge: PolicyType.VALIDATION_RULE,
          function: { _forge: FunctionCallType.TRANSFORMER, name: 'ValidatePostcode', arguments: [] },
        },
      },
    ])('should reject validation with $name', ({ rule }) => {
      // Arrange
      const invalidJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/review',
            title: 'Review',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'TextInput',
                code: 'postcode',
                validWhen: [rule],
              },
            ],
          },
        ],
      } as unknown as JourneyDefinition

      // Act
      const validate = () => DSLValidator.validateSchema(invalidJourney)

      // Assert
      expect(validate).toThrow(AggregateError)
    })

    it('should validate field validWhen supplied by an iterator', () => {
      const block = {
        _forge: ComponentCallType.FIELD,
        variant: 'TextInput',
        code: 'status',
        validWhen: {
          _forge: ExpressionType.ITERATE,
          input: { _forge: ExpressionType.REFERENCE, path: ['data', 'checks'] },
          iterator: {
            _forge: IteratorType.MAP,
            yield: {
              _forge: PolicyType.VALIDATION_RULE,
              condition: {
                _forge: PredicateType.TEST,
                negate: false,
                subject: { _forge: ExpressionType.REFERENCE, path: ['@scope', '0', 'enabled'] },
                condition: { _forge: FunctionCallType.CONDITION, name: 'Equals', arguments: [true] },
              },
              message: 'Check must be enabled',
            },
          },
        },
      } satisfies FieldBlockDefinition

      const validJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            _forge: StructureType.STEP,
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
            e => e instanceof ForgeSchemaError && e.formattedPath === 'test-journey > type',
          )
          expect(typeError).toBeDefined()
          expect(typeError?.message).toContain('Invalid input')
        }
      }
    })

    it('should render schema errors with a formatted DSL path', () => {
      // Arrange
      const invalidJourney = {
        _forge: StructureType.JOURNEY,
        path: '/travel-declaration',
        code: 'travel-declaration',
        title: 'Travel Declaration',
        steps: [
          {
            _forge: StructureType.STEP,
            path: '/personal-details',
            title: 'Personal details',
            blocks: [
              {
                _forge: ComponentCallType.FIELD,
                variant: 'GovUKInput',
                code: 'firstName',
                validWhen: [
                  {
                    _forge: PolicyType.VALIDATION_RULE,
                    message: null,
                    condition: {
                      _forge: PredicateType.TEST,
                      negate: false,
                      subject: { _forge: ExpressionType.REFERENCE, path: ['answers', 'firstName'] },
                      condition: { _forge: FunctionCallType.CONDITION, name: 'IsRequired', arguments: [] },
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
              e instanceof ForgeSchemaError &&
              e.formattedPath ===
                'travel-declaration > personal-details > blocks[0] (GovUKInput - firstName) > validWhen[0] > message',
          )

          expect(schemaError).toBeInstanceOf(ForgeSchemaError)
          expect((schemaError as ForgeSchemaError).formattedPath).toBe(
            'travel-declaration > personal-details > blocks[0] (GovUKInput - firstName) > validWhen[0] > message',
          )
        }
      }
    })

    it('should attach the nearest ancestor callsite to schema errors', () => {
      // Arrange
      const step = {
        _forge: StructureType.STEP,
        path: '/step1',
        title: 123,
        blocks: [],
      }
      Object.defineProperty(step, '__callsite', { value: { stack: 'at step-site' }, enumerable: false })
      const invalidJourney = {
        _forge: StructureType.JOURNEY,
        path: '/test-journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [step],
      } as unknown as JourneyDefinition

      // Act / Assert
      expect(() => DSLValidator.validateSchema(invalidJourney)).toThrow(AggregateError)

      try {
        DSLValidator.validateSchema(invalidJourney)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          const titleError = error.errors.find(
            e => e instanceof ForgeSchemaError && e.formattedPath === 'test-journey > step1 > title',
          ) as ForgeSchemaError | undefined

          expect(titleError).toBeInstanceOf(ForgeSchemaError)
          expect(titleError?.callsite).toEqual({ stack: 'at step-site' })
        }
      }
    })

    it('should fail when required fields are missing', () => {
      const invalidJourney = {
        _forge: StructureType.JOURNEY,
        steps: [],
      } as unknown as JourneyDefinition

      expect(() => DSLValidator.validateSchema(invalidJourney)).toThrow(AggregateError)

      try {
        DSLValidator.validateSchema(invalidJourney)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors.length).toBeGreaterThan(0)
          expect(error.errors.some(e => e instanceof ForgeSchemaError && e.formattedPath === 'root > code')).toBe(true)
          expect(error.errors.some(e => e instanceof ForgeSchemaError && e.formattedPath === 'root > title')).toBe(true)
        }
      }
    })

    it('should catch multiple errors in a schema', () => {
      const brokenJson = {
        _forge: StructureType.JOURNEY,
        code: 'strengths_and_needs',
        title: 'Strengths and Needs Assessment',
        path: '/strength-and-needs',
        children: [
          {
            _forge: StructureType.JOURNEY,
            code: null,
            title: null,
            path: null,
            onAccess: [
              {
                _forge: HookType.ACCESS,
                next: [
                  {
                    _forge: PolicyType.OUTCOME_REDIRECT,
                    goto: '/unauthorized',
                  },
                ],
              },
            ],
            steps: [
              {
                _forge: StructureType.STEP,
                path: '/test',
                title: null,
                blocks: [],
                onSubmission: [
                  {
                    _forge: HookType.SUBMIT,
                    validate: true,
                    onValid: {
                      next: [
                        {
                          _forge: PolicyType.OUTCOME_REDIRECT,
                          goto: '/next',
                        },
                      ],
                    },
                    onInvalid: {
                      next: [
                        {
                          _forge: PolicyType.OUTCOME_REDIRECT,
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
            e => e instanceof ForgeSchemaError && e.formattedPath === 'strengths_and_needs > children[0] > code',
          )
          expect(codeError).toBeDefined()

          const titleError = error.errors.find(
            e => e instanceof ForgeSchemaError && e.formattedPath === 'strengths_and_needs > children[0] > title',
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

    it('should throw ForgeSerialisationError when input is undefined', () => {
      expect(() => DSLValidator.validateJSON(undefined)).toThrow(ForgeSerialisationError)
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
          expect(err).toBeInstanceOf(ForgeSerialisationError)
          if (err instanceof ForgeSerialisationError) {
            expect(err.type).toBe('Function')
          }
        }
      }
    })

    it('should attach the nearest ancestor callsite to serialisation errors', () => {
      // Arrange
      const step = {
        type: 'step',
        path: '/step1',
        title: 'Step 1',
        onLoad: () => 'hello',
      }
      Object.defineProperty(step, '__callsite', { value: { stack: 'at step-site' }, enumerable: false })
      const objWithFunction = {
        type: 'journey',
        steps: [step],
      }

      // Act / Assert
      expect(() => DSLValidator.validateJSON(objWithFunction)).toThrow(AggregateError)

      try {
        DSLValidator.validateJSON(objWithFunction)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(1)
          const err = error.errors[0]
          expect(err).toBeInstanceOf(ForgeSerialisationError)
          if (err instanceof ForgeSerialisationError) {
            expect(err.type).toBe('Function')
            expect(err.callsite).toEqual({ stack: 'at step-site' })
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
          expect(err).toBeInstanceOf(ForgeSerialisationError)
          if (err instanceof ForgeSerialisationError) {
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
          expect(err).toBeInstanceOf(ForgeSerialisationError)
          if (err instanceof ForgeSerialisationError) {
            expect(err.type).toBe('Symbol')
          }
        }
      }
    })

    it('should throw ForgeSerialisationError for circular references', () => {
      const circularObject: any = {
        type: 'journey',
        nested: {
          value: 123,
        },
      }
      circularObject.nested.parent = circularObject

      expect(() => DSLValidator.validateJSON(circularObject)).toThrow(ForgeSerialisationError)

      try {
        DSLValidator.validateJSON(circularObject)
      } catch (error) {
        expect(error).toBeInstanceOf(ForgeSerialisationError)
        if (error instanceof ForgeSerialisationError) {
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
          expect(err).toBeInstanceOf(ForgeSerialisationError)
          if (err instanceof ForgeSerialisationError) {
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
          expect(err).toBeInstanceOf(ForgeSerialisationError)
          if (err instanceof ForgeSerialisationError) {
            expect(err.type).toContain('Non-plain object')
            expect(err.type).toContain('CustomClass')
          }
        }
      }
    })
  })
})
