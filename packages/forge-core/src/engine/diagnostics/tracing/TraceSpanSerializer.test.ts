import TraceSpan from './TraceSpan'
import TraceSpanSerializer from './TraceSpanSerializer'

describe('TraceSpanSerializer', () => {
  describe('serialize()', () => {
    it('should serialize nested trace spans with trace fields', () => {
      // Arrange
      const root = new TraceSpan('root', 'render.root')
      const child = new TraceSpan('child', 'resolve.block', root)
      const grandchild = new TraceSpan('grandchild', 'resolve.block', child)
      const serializer = new TraceSpanSerializer()

      root.addChild(child)
      child.addChild(grandchild)
      child.recordTraceMetadataAtStart({ variant: 'templateWrapper' })
      child.recordTraceMetadataAtFinish({ rendered: true })
      child.complete({ html: '<div>Done</div>' })
      grandchild.complete('<span>Nested</span>')

      // Act
      const result = serializer.serialize(root)

      // Assert
      expect(result).toMatchObject({
        key: 'root',
        kind: 'render.root',
        beginFields: {},
        completeFields: {},
        completed: false,
        startedAtMs: expect.any(Number),
        children: [
          {
            key: 'child',
            kind: 'resolve.block',
            beginFields: { variant: 'templateWrapper' },
            completeFields: { rendered: true },
            completed: true,
            startedAtMs: expect.any(Number),
            completedAtMs: expect.any(Number),
            durationMs: expect.any(Number),
            selfDurationMs: expect.any(Number),
            children: [
              {
                key: 'grandchild',
                kind: 'resolve.block',
                beginFields: {},
                completeFields: {},
                completed: true,
                startedAtMs: expect.any(Number),
                completedAtMs: expect.any(Number),
                durationMs: expect.any(Number),
                selfDurationMs: expect.any(Number),
                children: [],
              },
            ],
          },
        ],
      })
    })

    it('should serialize the recorded execution slices', () => {
      // Arrange
      const span = new TraceSpan('unit', 'render.block')
      const serializer = new TraceSpanSerializer()

      span.recordExecutionSlice(1, 3)
      span.recordExecutionSlice(8, 9)
      span.complete('output')

      // Act
      const result = serializer.serialize(span)

      // Assert
      expect(result.executionSlices).toEqual([
        { startedAtMs: 1, completedAtMs: 3 },
        { startedAtMs: 8, completedAtMs: 9 },
      ])
    })

    it('should omit execution slices when none were recorded', () => {
      // Arrange
      const span = new TraceSpan('unit', 'render.block')
      const serializer = new TraceSpanSerializer()

      span.complete('output')

      // Act
      const result = serializer.serialize(span)

      // Assert
      expect(result).not.toHaveProperty('executionSlices')
    })

    it('should drop children marked omit-from-trace', () => {
      // Arrange
      const root = new TraceSpan('root', 'submit.hook')
      const selected = new TraceSpan('onValid', 'submit.branch', root)
      const unselected = new TraceSpan('onInvalid', 'submit.branch', root)
      const serializer = new TraceSpanSerializer()

      root.addChild(selected)
      root.addChild(unselected)
      selected.complete({ status: 'continue' })
      unselected.complete({ status: 'continue' })
      unselected.markOmitFromTrace()

      // Act
      const result = serializer.serialize(root)

      // Assert
      expect(result.children.map(child => child.key)).toEqual(['onValid'])
    })
  })
})
