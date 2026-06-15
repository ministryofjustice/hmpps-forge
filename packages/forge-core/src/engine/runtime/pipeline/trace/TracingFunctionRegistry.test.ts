import FunctionRegistry from '../../../registries/FunctionRegistry'
import TraceRecorder from './TraceRecorder'
import TracingFunctionRegistry from './TracingFunctionRegistry'

describe('TracingFunctionRegistry', () => {
  describe('get()', () => {
    it('should wrap async entries with timing', async () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const evaluate = vi.fn().mockResolvedValue('done')
      functionRegistry.register({
        slowLookup: { name: 'slowLookup', isAsync: true, evaluate },
      })
      const recorder = new TraceRecorder()
      const tracingFunctionRegistry = new TracingFunctionRegistry(functionRegistry, recorder)

      recorder.beginPhase('render-evaluation')

      // Act
      const result = await tracingFunctionRegistry.get('slowLookup')?.evaluate('value')
      const trace = recorder.finish('render')

      // Assert
      expect(result).toBe('done')
      expect(evaluate).toHaveBeenCalledWith('value')
      expect(trace.phases[0].units).toEqual([expect.objectContaining({ kind: 'async-function', name: 'slowLookup' })])
    })

    it('should return sync entries unchanged', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const entry = {
        name: 'isEnabled',
        isAsync: false,
        evaluate: vi.fn().mockReturnValue(true),
      }
      const recorder = new TraceRecorder()
      const tracingFunctionRegistry = new TracingFunctionRegistry(functionRegistry, recorder)

      functionRegistry.register({ isEnabled: entry })

      // Act
      const result = tracingFunctionRegistry.get('isEnabled')

      // Assert
      expect(result).toBe(entry)
    })

    it('should return undefined when the wrapped registry has no entry', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const recorder = new TraceRecorder()
      const tracingFunctionRegistry = new TracingFunctionRegistry(functionRegistry, recorder)

      // Act
      const result = tracingFunctionRegistry.get('missing')

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('delegation', () => {
    it('should delegate has, getAll, and size to the wrapped registry', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const entry = {
        name: 'isEnabled',
        isAsync: false,
        evaluate: vi.fn().mockReturnValue(true),
      }
      const recorder = new TraceRecorder()
      const tracingFunctionRegistry = new TracingFunctionRegistry(functionRegistry, recorder)

      functionRegistry.register({ isEnabled: entry })

      // Act
      const hasEntry = tracingFunctionRegistry.has('isEnabled')
      const allEntries = tracingFunctionRegistry.getAll()
      const size = tracingFunctionRegistry.size()

      // Assert
      expect(hasEntry).toBe(true)
      expect(allEntries).toEqual(new Map([['isEnabled', entry]]))
      expect(size).toBe(1)
    })
  })
})
