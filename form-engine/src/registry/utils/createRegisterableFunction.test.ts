import { FunctionType } from '@form-engine/form/types/enums'
import {
  defineConditions,
  defineConditionsWithDeps,
  defineTransformers,
  defineTransformersWithDeps,
  defineEffects,
  defineEffectsWithDeps,
} from './createRegisterableFunction'

describe('createRegisterableFunction', () => {
  describe('defineConditions', () => {
    it('should create condition functions and registry', () => {
      const { conditions, registry } = defineConditions({
        IsPositive: (value: number) => value > 0,
        IsEven: (value: number) => value % 2 === 0,
        HasMinLength: (value: string, min: number) => value.length >= min,
      })

      // Test function builders exist
      expect(typeof conditions.IsPositive).toBe('function')
      expect(typeof conditions.IsEven).toBe('function')
      expect(typeof conditions.HasMinLength).toBe('function')

      // Test registry entries exist with correct structure
      expect(registry.IsPositive).toEqual({
        name: 'IsPositive',
        evaluate: expect.any(Function),
        isAsync: false,
      })
      expect(registry.IsEven).toEqual({
        name: 'IsEven',
        evaluate: expect.any(Function),
        isAsync: false,
      })
      expect(registry.HasMinLength).toEqual({
        name: 'HasMinLength',
        evaluate: expect.any(Function),
        isAsync: false,
      })
    })

    it('should create correct condition expressions', () => {
      const { conditions } = defineConditions({
        IsPositive: (value: number) => value > 0,
        HasMinLength: (value: string, min: number) => value.length >= min,
      })

      // Test expression creation with no arguments
      const positiveExpr = conditions.IsPositive()
      expect(positiveExpr).toEqual({
        type: FunctionType.CONDITION,
        name: 'IsPositive',
        arguments: [],
      })

      // Test expression creation with arguments
      const lengthExpr = conditions.HasMinLength(5)
      expect(lengthExpr).toEqual({
        type: FunctionType.CONDITION,
        name: 'HasMinLength',
        arguments: [5],
      })
    })

    it('should create working evaluator functions in registry', () => {
      const { registry } = defineConditions({
        IsPositive: (value: number) => value > 0,
        IsEven: (value: number) => value % 2 === 0,
        HasMinLength: (value: string, min: number) => value.length >= min,
      })

      // Test evaluators work correctly
      expect(registry.IsPositive.evaluate(5)).toBe(true)
      expect(registry.IsPositive.evaluate(-3)).toBe(false)

      expect(registry.IsEven.evaluate(4)).toBe(true)
      expect(registry.IsEven.evaluate(3)).toBe(false)

      expect(registry.HasMinLength.evaluate('hello', 3)).toBe(true)
      expect(registry.HasMinLength.evaluate('hi', 5)).toBe(false)
    })

    it('should support async condition evaluators', async () => {
      const { registry } = defineConditions({
        IsValidEmail: async (value: string) => {
          await new Promise<void>(resolve => {
            setTimeout(resolve, 1)
          })
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        },
      })

      const result = await registry.IsValidEmail.evaluate('test@example.com')
      expect(result).toBe(true)

      const invalidResult = await registry.IsValidEmail.evaluate('invalid-email')
      expect(invalidResult).toBe(false)
    })
  })

  describe('defineConditionsWithDeps', () => {
    it('should create conditions with dependency injection', () => {
      interface TestDeps {
        minAge: number
        apiClient: {
          validateUser: (id: string) => boolean
        }
      }

      const deps: TestDeps = {
        minAge: 18,
        apiClient: {
          validateUser: (id: string) => id === 'valid-user',
        },
      }

      const { conditions, createRegistry } = defineConditionsWithDeps<TestDeps>()({
        MeetsAgeRequirement: d => (age: number) => age >= d.minAge,
        IsValidUser: d => (userId: string) => d.apiClient.validateUser(userId),
      })

      // Test function builders exist (no deps needed)
      expect(typeof conditions.MeetsAgeRequirement).toBe('function')
      expect(typeof conditions.IsValidUser).toBe('function')

      // Create registry with real dependencies
      const registry = createRegistry(deps)

      // Test registry evaluators work with injected dependencies
      expect(registry.MeetsAgeRequirement.evaluate(20)).toBe(true)
      expect(registry.MeetsAgeRequirement.evaluate(16)).toBe(false)

      expect(registry.IsValidUser.evaluate('valid-user')).toBe(true)
      expect(registry.IsValidUser.evaluate('invalid-user')).toBe(false)
    })

    it('should create correct expressions with dependencies', () => {
      interface TestDeps {
        minValue: number
      }

      const { conditions } = defineConditionsWithDeps<TestDeps>()({
        ExceedsMin: d => (value: number) => value > d.minValue,
      })

      const expr = conditions.ExceedsMin()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'ExceedsMin',
        arguments: [],
      })
    })
  })

  describe('defineTransformers', () => {
    it('should create transformer functions and registry', () => {
      const { transformers, registry } = defineTransformers({
        ToUpperCase: (value: string) => value.toUpperCase(),
        Double: (value: number) => value * 2,
        Truncate: (value: string, maxLength: number) => {
          return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
        },
      })

      // Test function builders exist
      expect(typeof transformers.ToUpperCase).toBe('function')
      expect(typeof transformers.Double).toBe('function')
      expect(typeof transformers.Truncate).toBe('function')

      // Test registry entries exist with correct structure
      expect(registry.ToUpperCase).toEqual({
        name: 'ToUpperCase',
        evaluate: expect.any(Function),
        isAsync: false,
      })
    })

    it('should create correct transformer expressions', () => {
      const { transformers } = defineTransformers({
        ToUpperCase: (value: string) => value.toUpperCase(),
        Truncate: (value: string, maxLength: number) => value.slice(0, maxLength),
      })

      // Test expression creation with no arguments
      const upperExpr = transformers.ToUpperCase()
      expect(upperExpr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'ToUpperCase',
        arguments: [],
      })

      // Test expression creation with arguments
      const truncateExpr = transformers.Truncate(10)
      expect(truncateExpr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'Truncate',
        arguments: [10],
      })
    })

    it('should create working evaluator functions in registry', () => {
      const { registry } = defineTransformers({
        ToUpperCase: (value: string) => value.toUpperCase(),
        Double: (value: number) => value * 2,
        Truncate: (value: string, maxLength: number) => {
          return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
        },
      })

      // Test evaluators work correctly
      expect(registry.ToUpperCase.evaluate('hello')).toBe('HELLO')
      expect(registry.Double.evaluate(5)).toBe(10)
      expect(registry.Truncate.evaluate('hello world', 5)).toBe('hello...')
      expect(registry.Truncate.evaluate('hi', 5)).toBe('hi')
    })

    it('should support async transformer evaluators', async () => {
      const { registry } = defineTransformers({
        AsyncUpperCase: async (value: string) => {
          await new Promise<void>(resolve => {
            setTimeout(resolve, 1)
          })
          return value.toUpperCase()
        },
      })

      const result = await registry.AsyncUpperCase.evaluate('hello')
      expect(result).toBe('HELLO')
    })
  })

  describe('defineTransformersWithDeps', () => {
    it('should create transformers with dependency injection', () => {
      interface TestDeps {
        prefix: string
        formatter: {
          currency: (value: number) => string
        }
      }

      const deps: TestDeps = {
        prefix: 'PREFIX:',
        formatter: {
          currency: (value: number) => `$${value.toFixed(2)}`,
        },
      }

      const { transformers, createRegistry } = defineTransformersWithDeps<TestDeps>()({
        AddPrefix: d => (value: string) => d.prefix + value,
        FormatCurrency: d => (value: number) => d.formatter.currency(value),
      })

      // Test function builders exist (no deps needed)
      expect(typeof transformers.AddPrefix).toBe('function')
      expect(typeof transformers.FormatCurrency).toBe('function')

      // Create registry with real dependencies
      const registry = createRegistry(deps)

      // Test registry evaluators work with injected dependencies
      expect(registry.AddPrefix.evaluate('test')).toBe('PREFIX:test')
      expect(registry.FormatCurrency.evaluate(19.99)).toBe('$19.99')
    })
  })

  describe('defineEffects', () => {
    it('should create effect functions and registry', () => {
      const { effects, registry } = defineEffects({
        LogSubmission: (_context: any) => {
          // Side effect would happen here (e.g., logging)
        },
        SendEmail: (_context: any, _recipient: string, _subject: string) => {
          // Side effect would happen here (e.g., sending email)
        },
      })

      // Test function builders exist
      expect(typeof effects.LogSubmission).toBe('function')
      expect(typeof effects.SendEmail).toBe('function')

      // Test registry entries exist with correct structure
      expect(registry.LogSubmission).toEqual({
        name: 'LogSubmission',
        evaluate: expect.any(Function),
        isAsync: false,
      })
      expect(registry.SendEmail).toEqual({
        name: 'SendEmail',
        evaluate: expect.any(Function),
        isAsync: false,
      })
    })

    it('should create correct effect expressions', () => {
      const { effects } = defineEffects({
        LogSubmission: (_context: any) => {
          // Effect implementation
        },
        SendEmail: (_context: any, _recipient: string) => {
          // Effect implementation
        },
      })

      // Test expression creation with no arguments
      const logExpr = effects.LogSubmission()
      expect(logExpr).toEqual({
        type: FunctionType.EFFECT,
        name: 'LogSubmission',
        arguments: [],
      })

      // Test expression creation with arguments
      const emailExpr = effects.SendEmail('test@example.com')
      expect(emailExpr).toEqual({
        type: FunctionType.EFFECT,
        name: 'SendEmail',
        arguments: ['test@example.com'],
      })
    })

    it('should create working evaluator functions in registry', () => {
      const mockContext = {
        formData: { name: 'John' },
        formId: 'test-form',
      }

      // Track side effects
      const sideEffects: string[] = []

      const { registry } = defineEffects({
        LogSubmission: (context: any) => {
          sideEffects.push(`Logged: ${context.formId}`)
        },
        SendEmail: (context: any, recipient: string, subject: string) => {
          sideEffects.push(`Email sent to ${recipient} with subject: ${subject}`)
        },
      })

      // Test evaluators work correctly
      registry.LogSubmission.evaluate(mockContext)
      expect(sideEffects).toContain('Logged: test-form')

      registry.SendEmail.evaluate(mockContext, 'test@example.com', 'Test Subject')
      expect(sideEffects).toContain('Email sent to test@example.com with subject: Test Subject')
    })
  })

  describe('defineEffectsWithDeps', () => {
    it('should create effects with dependency injection', () => {
      interface TestDeps {
        emailService: {
          send: (to: string, subject: string, body: string) => { id: string; sent: boolean }
        }
        logger: {
          info: (message: string) => { logged: string }
        }
      }

      const deps: TestDeps = {
        emailService: {
          send: (_to: string, _subject: string, _body: string) => ({ id: 'email123', sent: true }),
        },
        logger: {
          info: (message: string) => ({ logged: message }),
        },
      }

      const { effects, createRegistry } = defineEffectsWithDeps<TestDeps>()({
        SendEmail: d => (context: any, recipient: string, subject: string) => {
          d.emailService.send(recipient, subject, JSON.stringify(context.formData))
        },
        LogAction: d => (context: any, action: string) => {
          d.logger.info(`${action}: ${context.formId}`)
        },
      })

      // Test function builders exist (no deps needed)
      expect(typeof effects.SendEmail).toBe('function')
      expect(typeof effects.LogAction).toBe('function')

      // Create registry with real dependencies
      const registry = createRegistry(deps)

      // Test registry evaluators work with injected dependencies
      const mockContext = { formData: { test: 'data' }, formId: 'form123' }

      // Spy on the dependencies to verify they were called
      const sendSpy = jest.spyOn(deps.emailService, 'send')
      const infoSpy = jest.spyOn(deps.logger, 'info')

      registry.SendEmail.evaluate(mockContext, 'test@example.com', 'Test')
      expect(sendSpy).toHaveBeenCalledWith('test@example.com', 'Test', JSON.stringify({ test: 'data' }))

      registry.LogAction.evaluate(mockContext, 'SUBMIT')
      expect(infoSpy).toHaveBeenCalledWith('SUBMIT: form123')
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle empty evaluator objects', () => {
      const { conditions, registry } = defineConditions({})

      expect(conditions).toEqual({})
      expect(registry).toEqual({})
    })

    it('should preserve function names correctly', () => {
      const { registry } = defineConditions({
        VeryLongConditionNameWithCamelCase: (value: string) => value.length > 0,
        Short: (value: boolean) => value,
      })

      expect(registry.VeryLongConditionNameWithCamelCase.name).toBe('VeryLongConditionNameWithCamelCase')
      expect(registry.Short.name).toBe('Short')
    })

    it('should handle functions with many parameters', () => {
      const { transformers, registry } = defineTransformers({
        ComplexTransform: (value: string, arg1: number, arg2: boolean, arg3: string, arg4: number) => {
          return `${value}-${arg1}-${arg2}-${arg3}-${arg4}`
        },
      })

      const expr = transformers.ComplexTransform(1, true, 'test', 42)
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'ComplexTransform',
        arguments: [1, true, 'test', 42],
      })

      const result = registry.ComplexTransform.evaluate('base', 1, true, 'test', 42)
      expect(result).toBe('base-1-true-test-42')
    })

    it('should handle dependency injection with complex dependency structures', () => {
      interface ComplexDeps {
        config: {
          api: {
            baseUrl: string
            timeout: number
          }
          validation: {
            emailRegex: RegExp
          }
        }
        services: {
          http: {
            get: (url: string) => { data: string }
          }
        }
      }

      const complexDeps: ComplexDeps = {
        config: {
          api: {
            baseUrl: 'https://api.example.com',
            timeout: 5000,
          },
          validation: {
            emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          },
        },
        services: {
          http: {
            get: (url: string) => ({ data: `mock-data-from-${url}` }),
          },
        },
      }

      const { createRegistry } = defineConditionsWithDeps<ComplexDeps>()({
        IsValidEmailFormat: d => (email: string) => {
          return d.config.validation.emailRegex.test(email)
        },
        CanReachAPI: d => (endpoint: string) => {
          const url = `${d.config.api.baseUrl}/${endpoint}`
          const response = d.services.http.get(url)
          return response.data.includes('mock-data')
        },
      })

      const registry = createRegistry(complexDeps)

      expect(registry.IsValidEmailFormat.evaluate('test@example.com')).toBe(true)
      expect(registry.IsValidEmailFormat.evaluate('invalid-email')).toBe(false)

      expect(registry.CanReachAPI.evaluate('users')).toBe(true)
    })
  })
})
