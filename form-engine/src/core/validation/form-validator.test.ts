import { StructureType, ExpressionType, TransitionType } from '@form-engine/form/types/enums'
import { JourneyDefinition, StepDefinition } from '@form-engine/form/types/structures.type'
import { FormValidator } from './form-validator'

describe('FormValidator', () => {
  let validator: FormValidator

  beforeEach(() => {
    validator = new FormValidator()
  })

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
      }

      const result = validator.validateSchema(validJourney)

      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should fail when type is missing with clear error path', () => {
      const invalidJourney = {
        // Missing type
        code: 'test-journey',
        title: 'Test Journey',
        steps: [],
      } as JourneyDefinition

      const result = validator.validateSchema(invalidJourney)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)

      const typeError = result.errors.find(e => e.path.includes('type'))
      expect(typeError).toBeDefined()
      expect(typeError?.message).toContain('Invalid input')
    })

    it('should fail when required fields are missing', () => {
      const invalidJourney = {
        type: StructureType.JOURNEY,
        steps: [],
      } as JourneyDefinition

      const result = validator.validateSchema(invalidJourney)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.path.includes('code'))).toBe(true)
      expect(result.errors.some(e => e.path.includes('title'))).toBe(true)
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

      const result = validator.validateSchema(brokenJson)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)

      const codeError = result.errors.find(e => e.path.join('.') === 'children.0.code')
      expect(codeError).toBeDefined()

      const titleError = result.errors.find(e => e.path.join('.') === 'children.0.title')
      expect(titleError).toBeDefined()
    })
  })

  describe('validateJSON', () => {
    it('should pass for valid JSON objects', () => {
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

      const result = validator.validateJSON(validJSON)

      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should detect circular references', () => {
      const circularObject: any = {
        name: 'test',
        nested: {
          value: 123,
        },
      }
      circularObject.nested.parent = circularObject

      const result = validator.validateJSON(circularObject)

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('json_error')
      expect(result.errors[0].message).toContain('Converting circular structure to JSON')
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

      const result = validator.validateJSON(deepObject)

      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })
  })
})
