import TraceRecorder, { measure, measureAsync, measureAsyncFrom, measureScoped } from './TraceRecorder'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { TraceUnit } from '../../../contracts/trace/requestTrace.type'

const fieldUnit = (nodeId: NodeId, isValid: boolean): TraceUnit => ({
  kind: 'field-validation',
  nodeId,
  isValid,
  failures: [],
  durationMs: 0,
})

describe('TraceRecorder', () => {
  describe('record()', () => {
    it('should group recorded units under the open phase', () => {
      // Arrange
      const recorder = new TraceRecorder()

      // Act
      recorder.beginPhase('validation')
      recorder.record(fieldUnit('compile_ast:1', true))
      recorder.record(fieldUnit('compile_ast:2', false))
      recorder.endPhase('continue')

      const trace = recorder.finish('render')

      // Assert
      expect(trace.phases).toHaveLength(1)
      expect(trace.phases[0].phase).toBe('validation')
      expect(trace.phases[0].units).toEqual([fieldUnit('compile_ast:1', true), fieldUnit('compile_ast:2', false)])
    })

    it('should drop units recorded when no phase is open', () => {
      // Arrange
      const recorder = new TraceRecorder()

      // Act
      recorder.record(fieldUnit('compile_ast:1', true))

      const trace = recorder.finish('render')

      // Assert
      expect(trace.phases).toHaveLength(0)
    })
  })

  describe('finish()', () => {
    it('should record phases in execution order with their outcomes', () => {
      // Arrange
      const recorder = new TraceRecorder()

      // Act
      recorder.beginPhase('access')
      recorder.endPhase('continue')
      recorder.beginPhase('navigation')
      recorder.endPhase('halt-redirect')

      const trace = recorder.finish('redirect')

      // Assert
      expect(trace.outcome).toBe('redirect')
      expect(trace.phases.map(phase => [phase.phase, phase.outcome])).toEqual([
        ['access', 'continue'],
        ['navigation', 'halt-redirect'],
      ])
    })

    it('should close a still-open phase with the finishing outcome when a phase threw', () => {
      // Arrange
      const recorder = new TraceRecorder()

      // Act
      recorder.beginPhase('submit-lifecycle')
      recorder.record(fieldUnit('compile_ast:1', false))

      const trace = recorder.finish('error')

      // Assert
      expect(trace.outcome).toBe('error')
      expect(trace.phases).toHaveLength(1)
      expect(trace.phases[0]).toEqual(
        expect.objectContaining({
          phase: 'submit-lifecycle',
          outcome: 'error',
          units: [fieldUnit('compile_ast:1', false)],
        }),
      )
    })

    it('should report a non-negative duration for the request and each phase', () => {
      // Arrange
      const recorder = new TraceRecorder()

      // Act
      recorder.beginPhase('access')
      recorder.endPhase('continue')

      const trace = recorder.finish('render')

      // Assert
      expect(trace.durationMs).toBeGreaterThanOrEqual(0)
      expect(trace.phases[0].durationMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('measure()', () => {
    it('should return the result of the callback and record a unit with durationMs', () => {
      // Arrange
      const recorder = new TraceRecorder()
      recorder.beginPhase('render-output')

      // Act
      const result = measure(recorder, { kind: 'page-assembly' }, () => 'rendered-html')

      const trace = recorder.finish('render')

      // Assert
      expect(result).toBe('rendered-html')
      expect(trace.phases[0].units).toHaveLength(1)
      expect(trace.phases[0].units[0]).toEqual(expect.objectContaining({ kind: 'page-assembly' }))
      expect((trace.phases[0].units[0] as TraceUnit & { durationMs: number }).durationMs).toBeGreaterThanOrEqual(0)
    })

    it('should run the callback and skip recording when trace is undefined', () => {
      // Arrange / Act
      const result = measure(undefined, { kind: 'page-assembly' }, () => 'rendered-html')

      // Assert
      expect(result).toBe('rendered-html')
    })
  })

  describe('measureAsync()', () => {
    it('should return the result of the async callback and record a unit with durationMs', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      recorder.beginPhase('render-evaluation')

      // Act
      const result = await measureAsync(
        recorder,
        { kind: 'block-evaluation', nodeId: 'test::block' as NodeId },
        async () => 'block-data',
      )

      const trace = recorder.finish('render')

      // Assert
      expect(result).toBe('block-data')
      expect(trace.phases[0].units).toHaveLength(1)
      expect(trace.phases[0].units[0]).toEqual(
        expect.objectContaining({ kind: 'block-evaluation', nodeId: 'test::block' }),
      )
    })

    it('should run the callback and skip recording when trace is undefined', async () => {
      // Arrange / Act
      const result = await measureAsync(undefined, { kind: 'page-assembly' }, async () => 'rendered-html')

      // Assert
      expect(result).toBe('rendered-html')
    })
  })

  describe('measureAsyncFrom()', () => {
    it('should build unit fields from the callback result', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      recorder.beginPhase('validation')

      // Act
      const result = await measureAsyncFrom(
        recorder,
        failures => ({
          kind: 'field-validation',
          nodeId: 'test::field' as NodeId,
          isValid: failures.length === 0,
          failures,
        }),
        async () =>
          [
            { field: 'name', message: 'required' },
          ] as unknown as import('../../../contracts/runtime/evaluationState.type').StepValidationFailure[],
      )

      const trace = recorder.finish('render')

      // Assert
      expect(result).toHaveLength(1)
      expect(trace.phases[0].units[0]).toEqual(
        expect.objectContaining({ kind: 'field-validation', nodeId: 'test::field', isValid: false }),
      )
    })
  })

  describe('beginScope()', () => {
    it('should collect recorded units in the scope instead of the phase', () => {
      // Arrange
      const recorder = new TraceRecorder()
      recorder.beginPhase('render-output')

      // Act
      recorder.beginScope()
      recorder.record(fieldUnit('compile_ast:1', true))
      recorder.record(fieldUnit('compile_ast:2', true))
      const children = recorder.endScope()

      const trace = recorder.finish('render')

      // Assert
      expect(children).toHaveLength(2)
      expect(trace.phases[0].units).toHaveLength(0)
    })

    it('should isolate nested scopes from each other', () => {
      // Arrange
      const recorder = new TraceRecorder()
      recorder.beginPhase('render-output')

      // Act
      recorder.beginScope()
      recorder.beginScope()
      recorder.record(fieldUnit('compile_ast:1', true))
      const innerChildren = recorder.endScope()
      recorder.record(fieldUnit('compile_ast:2', true))
      const outerChildren = recorder.endScope()

      // Assert
      expect(innerChildren).toHaveLength(1)
      expect(outerChildren).toHaveLength(1)
      expect(outerChildren[0]).toEqual(expect.objectContaining({ nodeId: 'compile_ast:2' }))
    })

    it('should fall through to phase when no scope is open', () => {
      // Arrange
      const recorder = new TraceRecorder()
      recorder.beginPhase('render-output')

      // Act
      recorder.record(fieldUnit('compile_ast:1', true))

      const trace = recorder.finish('render')

      // Assert
      expect(trace.phases[0].units).toHaveLength(1)
    })

    it('should return an empty array when endScope is called on an empty stack', () => {
      // Arrange
      const recorder = new TraceRecorder()

      // Act
      const result = recorder.endScope()

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('measureScoped()', () => {
    it('should collect inner record calls as children on the scoped unit', () => {
      // Arrange
      const recorder = new TraceRecorder()
      recorder.beginPhase('render-output')

      // Act
      measureScoped(recorder, { kind: 'block-render', nodeId: 'compile_ast:1' as NodeId, variant: 'fieldset' }, () => {
        measure(
          recorder,
          { kind: 'block-render', nodeId: 'compile_ast:2' as NodeId, variant: 'text-input' },
          () => 'child',
        )

        return 'parent'
      })

      const trace = recorder.finish('render')

      // Assert
      expect(trace.phases[0].units).toHaveLength(1)
      const parent = trace.phases[0].units[0] as TraceUnit & { children?: readonly TraceUnit[] }
      expect(parent).toEqual(expect.objectContaining({ kind: 'block-render', nodeId: 'compile_ast:1' }))
      expect(parent.children).toHaveLength(1)
      expect(parent.children![0]).toEqual(expect.objectContaining({ kind: 'block-render', nodeId: 'compile_ast:2' }))
    })

    it('should not include children field when no units are recorded inside the scope', () => {
      // Arrange
      const recorder = new TraceRecorder()
      recorder.beginPhase('render-output')

      // Act
      const result = measureScoped(
        recorder,
        { kind: 'block-render', nodeId: 'compile_ast:1' as NodeId, variant: 'fieldset' },
        () => 'leaf',
      )

      const trace = recorder.finish('render')

      // Assert
      expect(result).toBe('leaf')
      expect(trace.phases[0].units[0]).not.toHaveProperty('children')
    })

    it('should run the callback and skip recording when trace is undefined', () => {
      // Arrange / Act
      const result = measureScoped(undefined, { kind: 'page-assembly' }, () => 'rendered-html')

      // Assert
      expect(result).toBe('rendered-html')
    })
  })
})
