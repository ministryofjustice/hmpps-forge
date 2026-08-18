import WorkContext from './WorkContext'
import TraceSpan from '../tracing/TraceSpan'

describe('WorkContext', () => {
  describe('withWork()', () => {
    it('should return a new context with the same request context and the supplied work unit and props', () => {
      // Arrange
      const requestContext = { phase: 'render' }
      const props = { value: 'x' }
      const original = new WorkContext(requestContext)
      const work = new TraceSpan('work-1', 'resolve.block')

      // Act
      const result = original.withWork(work, props)

      // Assert
      expect(result).not.toBe(original)
      expect(result.state).toBe(requestContext)
      expect(result.props).toBe(props)
      expect(result.work).toBe(work)
      expect(original.work).toBeUndefined()
    })
  })
})
