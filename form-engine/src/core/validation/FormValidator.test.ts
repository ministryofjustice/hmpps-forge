import { StructureType, ExpressionType, TransitionType } from '@form-engine/form/types/enums'
import { JourneyDefinition, StepDefinition } from '@form-engine/form/types/structures.type'
import FormConfigurationSerialisationError from '@form-engine/errors/FormConfigurationSerialisationError'
import FormConfigurationSchemaError from '@form-engine/errors/FormConfigurationSchemaError'
import { FormValidator } from './FormValidator'

describe('FormValidator', () => {
  describe('validateJourney', () => {
    it('should validate a valid journey', () => {
      const validJourney = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            blocks: [],
          } as StepDefinition,
        ],
      } as JourneyDefinition

      expect(() => FormValidator.validateSchema(validJourney)).not.toThrow()
    })

    it('should fail when type is missing with clear error path', () => {
      const invalidJourney = {
        // Missing type
        code: 'test-journey',
        title: 'Test Journey',
        steps: [],
      } as JourneyDefinition

      expect(() => FormValidator.validateSchema(invalidJourney)).toThrow(AggregateError)

      try {
        FormValidator.validateSchema(invalidJourney)
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

      expect(() => FormValidator.validateSchema(invalidJourney)).toThrow(AggregateError)

      try {
        FormValidator.validateSchema(invalidJourney)
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
  })

  describe('real', () => {
    it('should catch all errors in the broken strengths-and-needs form', () => {
      const brokenJson = {
        type: StructureType.JOURNEY,
        code: 'strengths_and_needs',
        title: 'Strengths and Needs Assessment',
        path: '/strength-and-needs',
        version: '1.0',
        children: [
          {
            type: StructureType.JOURNEY,
            code: null,
            title: null,
            onAccess: [
              {
                type: TransitionType.ACCESS,
                redirect: [
                  {
                    goto: '/unauthorized',
                  },
                ],
              },
            ],
            steps: [
              {
                type: StructureType.STEP,
                path: '/test',
                blocks: [],
                onSubmission: [
                  {
                    type: TransitionType.SUBMIT,
                    validate: true,
                    onValid: {
                      next: [
                        {
                          goto: '/next',
                        },
                      ],
                    },
                    onInvalid: {
                      next: [
                        {
                          type: ExpressionType.NEXT,
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

      expect(() => FormValidator.validateSchema(brokenJson)).toThrow(AggregateError)

      try {
        FormValidator.validateSchema(brokenJson)
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

      expect(() => FormValidator.validateJSON(validJSON)).not.toThrow()
    })

    it('should throw FormConfigurationSerialisationError for undefined input', () => {
      expect(() => FormValidator.validateJSON(undefined)).toThrow(FormConfigurationSerialisationError)

      try {
        FormValidator.validateJSON(undefined)
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
          // eslint-disable-next-line no-empty-function
          anotherFunc() {},
        },
      }

      expect(() => FormValidator.validateJSON(invalidJSON)).toThrow(AggregateError)

      try {
        FormValidator.validateJSON(invalidJSON)
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

      expect(() => FormValidator.validateJSON(circularObject)).toThrow(FormConfigurationSerialisationError)

      try {
        FormValidator.validateJSON(circularObject)
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

      expect(() => FormValidator.validateJSON(deepObject)).not.toThrow()
    })

    it('should throw AggregateError for BigInt values', () => {
      const objWithBigInt = {
        value: BigInt(123),
      }

      expect(() => FormValidator.validateJSON(objWithBigInt)).toThrow(AggregateError)

      try {
        FormValidator.validateJSON(objWithBigInt)
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

      expect(() => FormValidator.validateJSON(objWithClass)).toThrow(AggregateError)

      try {
        FormValidator.validateJSON(objWithClass)
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
})
