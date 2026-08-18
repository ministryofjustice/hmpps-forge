import WorkTaskPropsWalker from './WorkTaskPropsWalker'
import type { CompletedWork, WorkTask, WorkHandler } from '../contracts/work/work.type'
import { createWorkTask } from './workTask'

const childWorkHandler: WorkHandler<'test.child', Record<string, unknown>> = {
  kind: 'test.child',
  begin: ctx => ({ output: String(ctx.props.value) }),
}

class CustomProps {
  constructor(private readonly childWorkTask: WorkTask) {}

  getChild(): WorkTask {
    return this.childWorkTask
  }
}

function createChild(key: string): WorkTask<'test.child', Record<string, unknown>> {
  return createWorkTask(key, childWorkHandler, { value: key })
}

function createCompletedWork(key: string, output: unknown, kind = childWorkHandler.kind): CompletedWork {
  return {
    key,
    kind,
    output,
    children: [],
  }
}

describe('WorkTaskPropsWalker', () => {
  describe('collect()', () => {
    it('should collect tasks from direct values arrays and nested records in prop order', () => {
      // Arrange
      const first = createChild('first')
      const second = createChild('second')
      const third = createChild('third')
      const fourth = createChild('fourth')
      const walker = new WorkTaskPropsWalker()
      const props = {
        direct: first,
        array: [second, { nested: third }],
        record: {
          child: fourth,
        },
      }

      // Act
      const result = walker.collect(props)

      // Assert
      expect(result.map(workTask => workTask.key)).toEqual(['first', 'second', 'third', 'fourth'])
    })

    it('should stop at task boundaries and not collect grandchildren from task props', () => {
      // Arrange
      const grandchild = createChild('grandchild')
      const child = createWorkTask('child', childWorkHandler, { grandchild })
      const walker = new WorkTaskPropsWalker()

      // Act
      const result = walker.collect({ child })

      // Assert
      expect(result.map(workTask => workTask.key)).toEqual(['child'])
    })

    it('should ignore primitives null undefined dates class instances and malformed task-like objects', () => {
      // Arrange
      const child = createChild('child')
      const walker = new WorkTaskPropsWalker()
      const props = {
        missing: undefined,
        empty: null,
        value: 'text',
        createdAt: new Date('2026-06-17T00:00:00.000Z'),
        custom: new CustomProps(child),
        malformed: {
          $$typeof: Symbol.for('forge.work'),
          key: 'malformed',
          props: { child },
        },
      }

      // Act
      const result = walker.collect(props)

      // Assert
      expect(result).toEqual([])
    })

    it('should collect repeated task references as separate prop occurrences', () => {
      // Arrange
      const child = createChild('child')
      const walker = new WorkTaskPropsWalker()

      // Act
      const result = walker.collect({ first: child, second: child })

      // Assert
      expect(result.map(workTask => workTask.key)).toEqual(['child', 'child'])
    })

    it('should collect tasks from enumerable symbol keys', () => {
      // Arrange
      const symbolKey = Symbol('child')
      const child = createChild('child')
      const walker = new WorkTaskPropsWalker()

      // Act
      const result = walker.collect({ [symbolKey]: child })

      // Assert
      expect(result).toEqual([child])
    })

    it('should collect a task supplied as the root value', () => {
      // Arrange
      const child = createChild('child')
      const walker = new WorkTaskPropsWalker()

      // Act
      const result = walker.collect(child)

      // Assert
      expect(result).toEqual([child])
    })

    it('should throw when props contain a cycle', () => {
      // Arrange
      const walker = new WorkTaskPropsWalker()
      const props: Record<string, unknown> = {}

      props.self = props

      // Act & Assert
      expect(() => walker.collect(props)).toThrow('Cannot walk cyclic work task props')
    })
  })

  describe('replaceCompletedOutputs()', () => {
    it('should replace tasks with completed outputs in prop order', () => {
      // Arrange
      const first = createChild('first')
      const second = createChild('second')
      const third = createChild('third')
      const walker = new WorkTaskPropsWalker()
      const props = {
        direct: first,
        array: [second, { nested: third }],
        staticValue: 'kept',
      }
      const completedWorks = [
        createCompletedWork('first', 'one'),
        createCompletedWork('second', 'two'),
        createCompletedWork('third', undefined),
      ]

      // Act
      const result = walker.replaceCompletedOutputs(props, completedWorks)

      // Assert
      expect(result).toEqual({
        direct: 'one',
        array: ['two', { nested: undefined }],
        staticValue: 'kept',
      })
    })

    it('should replace a task supplied as the root value', () => {
      // Arrange
      const child = createChild('child')
      const walker = new WorkTaskPropsWalker()

      // Act
      const result = walker.replaceCompletedOutputs(child, [createCompletedWork('child', 'done')])

      // Assert
      expect(result).toBe('done')
    })

    it('should preserve arrays without filtering undefined outputs', () => {
      // Arrange
      const child = createChild('child')
      const walker = new WorkTaskPropsWalker()

      // Act
      const result = walker.replaceCompletedOutputs([child, 'after'], [createCompletedWork('child', undefined)])

      // Assert
      expect(result).toEqual([undefined, 'after'])
    })

    it('should preserve non-task object values by identity', () => {
      // Arrange
      const createdAt = new Date('2026-06-17T00:00:00.000Z')
      const child = createChild('child')
      const customProps = new CustomProps(child)
      const walker = new WorkTaskPropsWalker()

      // Act
      const result = walker.replaceCompletedOutputs({ createdAt, customProps }, [])

      // Assert
      expect(result).toEqual({ createdAt, customProps })
      expect((result as { readonly createdAt: Date }).createdAt).toBe(createdAt)
      expect((result as { readonly customProps: CustomProps }).customProps).toBe(customProps)
    })

    it('should replace tasks from enumerable symbol keys', () => {
      // Arrange
      const symbolKey = Symbol('child')
      const child = createChild('child')
      const walker = new WorkTaskPropsWalker()

      // Act
      const result = walker.replaceCompletedOutputs({ [symbolKey]: child }, [createCompletedWork('child', 'done')])

      // Assert
      expect(result).toEqual({ [symbolKey]: 'done' })
    })

    it('should not mutate the original props object or arrays', () => {
      // Arrange
      const first = createChild('first')
      const second = createChild('second')
      const walker = new WorkTaskPropsWalker()
      const array = [second]
      const props = { first, array }

      // Act
      const result = walker.replaceCompletedOutputs(props, [
        createCompletedWork('first', 'one'),
        createCompletedWork('second', 'two'),
      ])

      // Assert
      expect(result).toEqual({ first: 'one', array: ['two'] })
      expect(props).toEqual({ first, array })
      expect(array).toEqual([second])
    })

    it('should replace duplicate keys by task occurrence order', () => {
      // Arrange
      const first = createChild('duplicate')
      const second = createChild('duplicate')
      const walker = new WorkTaskPropsWalker()

      // Act
      const result = walker.replaceCompletedOutputs({ first, second }, [
        createCompletedWork('duplicate', 'one'),
        createCompletedWork('duplicate', 'two'),
      ])

      // Assert
      expect(result).toEqual({ first: 'one', second: 'two' })
    })

    it('should round-trip collect then replace preserving position for same-key sibling tasks', () => {
      // Arrange — collect and replace must walk identically so the running index stays aligned
      const left = createChild('dup')
      const right = createChild('dup')
      const walker = new WorkTaskPropsWalker()
      const props = { left, right }

      // Act
      const collected = walker.collect(props)
      const completedWorks = collected.map((workTask, index) => createCompletedWork(workTask.key, `out-${index}`))
      const result = walker.replaceCompletedOutputs(props, completedWorks)

      // Assert
      expect(collected.map(workTask => workTask.key)).toEqual(['dup', 'dup'])
      expect(result).toEqual({ left: 'out-0', right: 'out-1' })
    })

    it('should throw when completed work is missing', () => {
      // Arrange
      const child = createChild('child')
      const walker = new WorkTaskPropsWalker()

      // Act & Assert
      expect(() => walker.replaceCompletedOutputs({ child }, [])).toThrow('Missing completed work for task "child"')
    })

    it('should throw when completed work does not match task key or kind', () => {
      // Arrange
      const child = createChild('child')
      const walker = new WorkTaskPropsWalker()

      // Act & Assert
      expect(() => walker.replaceCompletedOutputs({ child }, [createCompletedWork('other', 'done')])).toThrow(
        'Completed work "other" of kind "test.child" does not match task "child" of kind "test.child"',
      )
    })

    it('should throw when completed work remains unused', () => {
      // Arrange
      const child = createChild('child')
      const walker = new WorkTaskPropsWalker()

      // Act & Assert
      expect(() =>
        walker.replaceCompletedOutputs({ child }, [
          createCompletedWork('child', 'done'),
          createCompletedWork('extra', 'unused'),
        ]),
      ).toThrow('Unused completed work remains from task "extra"')
    })

    it('should throw when props contain a cycle', () => {
      // Arrange
      const walker = new WorkTaskPropsWalker()
      const props: Record<string, unknown> = {}

      props.self = props

      // Act & Assert
      expect(() => walker.replaceCompletedOutputs(props, [])).toThrow('Cannot walk cyclic work task props')
    })
  })
})
