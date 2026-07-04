import WorkUnit from '../WorkUnit'
import WorkUnitTraceSerializer from './WorkUnitTraceSerializer'

describe('WorkUnitTraceSerializer', () => {
  describe('serialize()', () => {
    it('should serialize nested work units with trace fields', () => {
      // Arrange
      const root = new WorkUnit('root', 'render.root')
      const child = new WorkUnit('child', 'resolve.block', root)
      const grandchild = new WorkUnit('grandchild', 'resolve.block', child)
      const serializer = new WorkUnitTraceSerializer()

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

    it('should drop children marked omit-from-trace', () => {
      // Arrange
      const root = new WorkUnit('root', 'submit.hook')
      const selected = new WorkUnit('onValid', 'submit.branch', root)
      const unselected = new WorkUnit('onInvalid', 'submit.branch', root)
      const serializer = new WorkUnitTraceSerializer()

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
