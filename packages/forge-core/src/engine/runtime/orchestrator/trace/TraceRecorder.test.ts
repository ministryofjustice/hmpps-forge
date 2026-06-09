import TraceRecorder from './TraceRecorder'
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
      recorder.beginPhase('submit-hooks')
      recorder.record(fieldUnit('compile_ast:1', false))

      const trace = recorder.finish('error')

      // Assert
      expect(trace.outcome).toBe('error')
      expect(trace.phases).toHaveLength(1)
      expect(trace.phases[0]).toEqual(
        expect.objectContaining({
          phase: 'submit-hooks',
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
})
