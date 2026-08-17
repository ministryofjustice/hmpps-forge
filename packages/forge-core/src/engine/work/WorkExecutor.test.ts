import WorkContext from './WorkContext'
import TraceSpan from '../tracing/TraceSpan'
import WorkExecutor from './WorkExecutor'
import WorkExecutionError from './WorkExecutionError'
import type { CompletedWork, WorkTask, WorkHandler, WorkInstrumentation } from '../contracts/work/work.type'
import { createWorkTask } from './workTask'
import type { TraceSpanReference } from '../tracing/traceSpan.type'

interface TestCompiledContext {
  readonly phase: string
}

interface Deferred<TValue> {
  readonly promise: Promise<TValue>
  resolve(value: TValue): void
}

type TestWorkGroupTemplate =
  | { readonly mode: 'sequential' }
  | { readonly mode: 'concurrent' }
  | { readonly mode: 'first-match'; readonly matches: (work: CompletedWork) => boolean }

function createDeferred<TValue>(): Deferred<TValue> {
  let resolveDeferred: (value: TValue) => void = () => {}
  const promise = new Promise<TValue>(resolve => {
    resolveDeferred = resolve
  })

  return {
    promise,
    resolve: resolveDeferred,
  }
}

function createContext(work?: TraceSpan): WorkContext<TestCompiledContext> {
  return new WorkContext({ phase: 'test' }, work)
}

function createOutputElement(key: string, output: string, calls: string[] = []): WorkTask {
  const type: WorkHandler = {
    kind: 'test.child',
    begin: () => {
      calls.push(key)

      return { output }
    },
  }

  return createWorkTask(key, type, {})
}

function createParentElement(children: readonly WorkTask[], group: TestWorkGroupTemplate): WorkTask {
  const type: WorkHandler = {
    kind: 'test.parent',
    begin: () => ({
      groups: [
        {
          ...group,
          children,
        },
      ],
    }),
    complete: (_ctx, completedChildren) => completedChildren.map(child => child.output),
  }

  return createWorkTask('parent', type, {})
}

function busyWaitMs(durationMs: number): void {
  const start = performance.now()

  while (performance.now() - start < durationMs) {
    // Spin to burn real synchronous CPU time while holding the event loop.
  }
}

describe('WorkExecutor', () => {
  describe('execute()', () => {
    it('should complete begin-only work with no children', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const element = createOutputElement('child-1', 'done')

      // Act
      const result = await executor.execute(element, createContext())

      // Assert
      expect(result).toEqual({
        key: 'child-1',
        kind: 'test.child',
        output: 'done',
        children: [],
      })
    })

    it('should return the executor-created work unit with executeWithUnit', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const element = createOutputElement('child-1', 'done')

      // Act
      const result = await executor.executeWithUnit(element, createContext())

      // Assert
      expect(result.completedWork).toEqual({
        key: 'child-1',
        kind: 'test.child',
        output: 'done',
        children: [],
      })
      expect(result.traceSpan.key).toBe('child-1')
      expect(result.traceSpan.kind).toBe('test.child')
      expect(result.traceSpan.completed).toBe(true)
    })

    it('should run sequential reduce-all children in declaration order', async () => {
      // Arrange
      const calls: string[] = []
      const executor = new WorkExecutor()
      const element = createParentElement(
        [
          createOutputElement('child-1', 'one', calls),
          createOutputElement('child-2', 'two', calls),
          createOutputElement('child-3', 'three', calls),
        ],
        { mode: 'sequential' },
      )

      // Act
      const result = await executor.execute(element, createContext())

      // Assert
      expect(calls).toEqual(['child-1', 'child-2', 'child-3'])
      expect(result.children.map(child => child.key)).toEqual(['child-1', 'child-2', 'child-3'])
      expect(result.output).toEqual(['one', 'two', 'three'])
    })

    it('should run concurrent reduce-all children and preserve declaration order', async () => {
      // Arrange
      const calls: string[] = []
      const first = createDeferred<string>()
      const second = createDeferred<string>()
      const executor = new WorkExecutor()
      const firstType: WorkHandler = {
        kind: 'test.child',
        begin: async () => {
          calls.push('child-1')

          return { output: await first.promise }
        },
      }
      const secondType: WorkHandler = {
        kind: 'test.child',
        begin: async () => {
          calls.push('child-2')
          second.resolve('two')

          return { output: await second.promise }
        },
      }
      const element = createParentElement(
        [createWorkTask('child-1', firstType, {}), createWorkTask('child-2', secondType, {})],
        { mode: 'concurrent' },
      )
      const pending = executor.execute(element, createContext())

      while (calls.length < 2) {
        await Promise.resolve()
      }

      first.resolve('one')

      // Act
      const result = await pending

      // Assert
      expect(calls).toEqual(['child-1', 'child-2'])
      expect(result.children.map(child => child.key)).toEqual(['child-1', 'child-2'])
      expect(result.output).toEqual(['one', 'two'])
    })

    it('should stop sequential first-match children after the fired predicate matches', async () => {
      // Arrange
      const calls: string[] = []
      const executor = new WorkExecutor()
      const element = createParentElement(
        [
          createOutputElement('child-1', 'continue', calls),
          createOutputElement('child-2', 'stop', calls),
          createOutputElement('child-3', 'skipped', calls),
        ],
        {
          mode: 'first-match',
          matches: completedWork => completedWork.output === 'stop',
        },
      )

      // Act
      const result = await executor.execute(element, createContext())

      // Assert
      expect(calls).toEqual(['child-1', 'child-2'])
      expect(result.children.map(child => child.key)).toEqual(['child-1', 'child-2'])
      expect(result.output).toEqual(['continue', 'stop'])
    })

    it('should pass completed children to complete and return its output', async () => {
      // Arrange
      const executor = new WorkExecutor()
      let receivedChildren: readonly CompletedWork[] = []
      const child = createOutputElement('child-1', 'done')
      const type: WorkHandler = {
        kind: 'test.parent',
        begin: () => ({
          groups: [{ mode: 'sequential', children: [child] }],
        }),
        complete: (_ctx, children) => {
          receivedChildren = children

          return { count: children.length, first: children[0].output }
        },
      }
      const element = createWorkTask('parent', type, {})

      // Act
      const result = await executor.execute(element, createContext())

      // Assert
      expect(receivedChildren).toHaveLength(1)
      expect(result.output).toEqual({ count: 1, first: 'done' })
    })

    it('should reject when begin throws and leave the work unit incomplete', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const parent = new TraceSpan('root', 'test.root')
      const error = new Error('begin failed')
      const type: WorkHandler = {
        kind: 'test.failure',
        begin: () => {
          throw error
        },
      }
      const instrumentation: WorkInstrumentation = {
        resolveTraceMetadataAtStart: () => ({ phase: 'begin' }),
        resolveTraceMetadataAtFinish: () => ({ phase: 'complete' }),
      }
      const element = createWorkTask('failed', type, {}, instrumentation)

      // Act & Assert
      await expect(executor.execute(element, createContext(parent))).rejects.toBe(error)
      expect(parent.children).toHaveLength(1)
      expect(parent.children[0].beginFields).toEqual({ phase: 'begin' })
      expect(parent.children[0].completed).toBe(false)
      expect(parent.children[0].completeFields).toEqual({})
    })

    it('should reject when start instrumentation throws and leave the work unit incomplete', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const parent = new TraceSpan('root', 'test.root')
      const error = new Error('start instrumentation failed')
      const type: WorkHandler = {
        kind: 'test.trace-begin-failure',
        begin: () => ({ output: 'done' }),
      }
      const instrumentation: WorkInstrumentation = {
        resolveTraceMetadataAtStart: () => {
          throw error
        },
        resolveTraceMetadataAtFinish: () => undefined,
      }
      const element = createWorkTask('failed', type, {}, instrumentation)

      // Act & Assert
      await expect(executor.execute(element, createContext(parent))).rejects.toBe(error)
      expect(parent.children).toHaveLength(1)
      expect(parent.children[0].completed).toBe(false)
      expect(parent.children[0].beginFields).toEqual({})
      expect(parent.children[0].completeFields).toEqual({})
    })

    it('should reject when a child throws and leave parent and child work units incomplete', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const root = new TraceSpan('root', 'test.root')
      const error = new Error('child failed')
      const childType: WorkHandler = {
        kind: 'test.child',
        begin: () => {
          throw error
        },
      }
      const parentType: WorkHandler = {
        kind: 'test.parent',
        begin: () => ({
          groups: [
            {
              mode: 'sequential',
              children: [createWorkTask('child', childType, {})],
            },
          ],
        }),
        complete: () => 'should-not-complete',
      }
      const element = createWorkTask('parent', parentType, {})

      // Act & Assert
      await expect(executor.execute(element, createContext(root))).rejects.toBe(error)
      expect(root.children).toHaveLength(1)
      expect(root.children[0].completed).toBe(false)
      expect(root.children[0].children).toHaveLength(1)
      expect(root.children[0].children[0].completed).toBe(false)
    })

    it('should reject when complete throws and leave the work unit incomplete', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const parent = new TraceSpan('root', 'test.root')
      const error = new Error('complete failed')
      const type: WorkHandler = {
        kind: 'test.failure',
        begin: () => ({ output: 'begin-output' }),
        complete: () => {
          throw error
        },
      }
      const instrumentation: WorkInstrumentation = {
        resolveTraceMetadataAtStart: () => undefined,
        resolveTraceMetadataAtFinish: () => ({ phase: 'complete' }),
      }
      const element = createWorkTask('failed', type, {}, instrumentation)

      // Act & Assert
      await expect(executor.execute(element, createContext(parent))).rejects.toBe(error)
      expect(parent.children).toHaveLength(1)
      expect(parent.children[0].completed).toBe(false)
      expect(parent.children[0].completeFields).toEqual({})
    })

    it('should reject when finish instrumentation throws and leave the work unit incomplete', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const parent = new TraceSpan('root', 'test.root')
      const error = new Error('finish instrumentation failed')
      const type: WorkHandler = {
        kind: 'test.trace-failure',
        begin: () => ({ output: 'done' }),
      }
      const instrumentation: WorkInstrumentation = {
        resolveTraceMetadataAtStart: () => ({ phase: 'begin' }),
        resolveTraceMetadataAtFinish: () => {
          throw error
        },
      }
      const element = createWorkTask('failed', type, {}, instrumentation)

      // Act & Assert
      await expect(executor.execute(element, createContext(parent))).rejects.toBe(error)
      expect(parent.children).toHaveLength(1)
      expect(parent.children[0].beginFields).toEqual({ phase: 'begin' })
      expect(parent.children[0].completed).toBe(false)
      expect(parent.children[0].completeFields).toEqual({})
    })

    it('should attach trace fields and nest runtime work units', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const parent = new TraceSpan('root', 'test.root')
      const childType: WorkHandler = {
        kind: 'test.child',
        begin: () => ({ output: 'child-output' }),
      }
      const childInstrumentation: WorkInstrumentation = {
        resolveTraceMetadataAtStart: ctx => ({ key: ctx.work?.key, stage: 'child-begin' }),
        resolveTraceMetadataAtFinish: (_ctx, output) => ({ output, stage: 'child-complete' }),
      }
      const parentType: WorkHandler = {
        kind: 'test.parent',
        begin: () => ({
          groups: [
            {
              mode: 'sequential',
              children: [createWorkTask('child', childType, {}, childInstrumentation)],
            },
          ],
        }),
        complete: (_ctx, children) => children[0].output,
      }
      const parentInstrumentation: WorkInstrumentation = {
        resolveTraceMetadataAtStart: ctx => ({ key: ctx.work?.key, stage: 'parent-begin' }),
        resolveTraceMetadataAtFinish: (_ctx, output) => ({ output, stage: 'parent-complete' }),
      }
      const element = createWorkTask('parent', parentType, {}, parentInstrumentation)

      // Act
      const result = await executor.execute(element, createContext(parent))

      // Assert
      expect(result.output).toBe('child-output')
      expect(parent.children).toHaveLength(1)
      expect(parent.children[0].beginFields).toEqual({ key: 'parent', stage: 'parent-begin' })
      expect(parent.children[0].completeFields).toEqual({ output: 'child-output', stage: 'parent-complete' })
      expect(parent.children[0].children).toHaveLength(1)
      expect(parent.children[0].children[0].beginFields).toEqual({ key: 'child', stage: 'child-begin' })
      expect(parent.children[0].children[0].completeFields).toEqual({
        output: 'child-output',
        stage: 'child-complete',
      })
    })

    it('should skip instrumentation when tracing is disabled', async () => {
      // Arrange
      const executor = new WorkExecutor(false)
      const parent = new TraceSpan('root', 'test.root')
      let startCalls = 0
      let finishCalls = 0
      const type: WorkHandler = {
        kind: 'test.instrumented',
        begin: () => ({ output: 'done' }),
      }
      const instrumentation: WorkInstrumentation = {
        resolveTraceMetadataAtStart: () => {
          startCalls += 1

          return { phase: 'begin' }
        },
        resolveTraceMetadataAtFinish: () => {
          finishCalls += 1

          return { phase: 'complete' }
        },
      }
      const element = createWorkTask('instrumented', type, {}, instrumentation)

      // Act
      await executor.execute(element, createContext(parent))

      // Assert
      expect(startCalls).toBe(0)
      expect(finishCalls).toBe(0)
      expect(parent.children[0].beginFields).toEqual({})
      expect(parent.children[0].completeFields).toEqual({})
    })

    it('should record empty fields when one instrumentation side returns undefined', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const parent = new TraceSpan('root', 'test.root')
      const type: WorkHandler = {
        kind: 'test.instrumented',
        begin: () => ({ output: 'done' }),
      }
      const instrumentation: WorkInstrumentation = {
        resolveTraceMetadataAtStart: () => ({ phase: 'begin' }),
        resolveTraceMetadataAtFinish: () => undefined,
      }
      const element = createWorkTask('instrumented', type, {}, instrumentation)

      // Act
      await executor.execute(element, createContext(parent))

      // Assert
      expect(parent.children[0].beginFields).toEqual({ phase: 'begin' })
      expect(parent.children[0].completeFields).toEqual({})
    })

    it('should reject when the work context parent is not a TraceSpan', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const foreignParent: TraceSpanReference = {
        key: 'foreign',
        kind: 'foreign.parent',
        children: [],
        beginFields: {},
        completeFields: {},
        completed: false,
        startedAtMs: 0,
      }
      const ctx = new WorkContext({ phase: 'test' }, foreignParent)
      const element = createOutputElement('child', 'child-output')

      // Act & Assert
      await expect(executor.execute(element, ctx)).rejects.toThrow('must be a TraceSpan')
    })

    it('should wrap an executeWithUnit failure in a WorkExecutionError carrying the partial unit', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const error = new Error('child failed')
      const childType: WorkHandler = {
        kind: 'test.child',
        begin: () => {
          throw error
        },
      }
      const parentType: WorkHandler = {
        kind: 'test.parent',
        begin: () => ({
          groups: [
            {
              mode: 'sequential',
              children: [createWorkTask('child', childType, {})],
            },
          ],
        }),
        complete: () => 'unreached',
      }
      const element = createWorkTask('parent', parentType, {})

      // Act
      let rejection: unknown

      try {
        await executor.executeWithUnit(element, createContext())
      } catch (caught) {
        rejection = caught
      }

      // Assert
      expect(rejection).toBeInstanceOf(WorkExecutionError)
      if (!(rejection instanceof WorkExecutionError)) {
        throw new Error('expected a WorkExecutionError')
      }

      expect(rejection.original).toBe(error)
      expect(rejection.traceSpan.key).toBe('parent')
      expect(rejection.traceSpan.completed).toBe(false)
      expect(rejection.traceSpan.children).toHaveLength(1)
      expect(rejection.traceSpan.children[0].completed).toBe(false)
    })

    it('should charge self time to the busy sibling only when concurrent siblings interleave', async () => {
      // Arrange
      const executor = new WorkExecutor()
      // Both children suspend in begin so their completions interleave on the microtask
      // queue — synchronous children would run to completion serially and never smear.
      const busyType: WorkHandler = {
        kind: 'test.child',
        begin: async () => ({ output: 'begin' }),
        complete: () => {
          busyWaitMs(20)

          return 'busy'
        },
      }
      const idleType: WorkHandler = {
        kind: 'test.child',
        begin: async () => ({ output: 'idle' }),
      }
      const element = createParentElement(
        [createWorkTask('busy', busyType, {}), createWorkTask('idle', idleType, {})],
        { mode: 'concurrent' },
      )

      // Act
      const { traceSpan } = await executor.executeWithUnit(element, createContext())

      // Assert
      const [busyUnit, idleUnit] = traceSpan.children
      expect(busyUnit.selfDurationMs).toBeGreaterThanOrEqual(20)
      expect(idleUnit.selfDurationMs).toBeLessThan(10)
      expect(busyUnit.durationMs).toBeGreaterThanOrEqual(20)
      expect(idleUnit.durationMs).toBeGreaterThanOrEqual(20)
    })

    it('should exclude child execution time from a parent self time', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const slowChildType: WorkHandler = {
        kind: 'test.child',
        begin: () => {
          busyWaitMs(20)

          return { output: 'slow' }
        },
      }
      const parentType: WorkHandler = {
        kind: 'test.parent',
        begin: () => ({
          groups: [{ mode: 'sequential', children: [createWorkTask('slow-child', slowChildType, {})] }],
        }),
        complete: (_ctx, children) => children.map(child => child.output),
      }
      const element = createWorkTask('parent', parentType, {})

      // Act
      const { traceSpan } = await executor.executeWithUnit(element, createContext())

      // Assert
      const [childUnit] = traceSpan.children
      expect(childUnit.selfDurationMs).toBeGreaterThanOrEqual(20)
      expect(traceSpan.selfDurationMs).toBeLessThan(10)
      expect(traceSpan.durationMs).toBeGreaterThanOrEqual(20)
    })

    it('should record a begin and a complete execution slice for a completed unit', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const element = createOutputElement('child-1', 'done')

      // Act
      const { traceSpan } = await executor.executeWithUnit(element, createContext())

      // Assert
      expect(traceSpan.executionSlices).toHaveLength(2)
      traceSpan.executionSlices.forEach(slice => {
        expect(slice.completedAtMs).toBeGreaterThanOrEqual(slice.startedAtMs)
      })
    })

    it('should record disjoint execution slices for serially-executed concurrent siblings', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const firstBusyType: WorkHandler = {
        kind: 'test.child',
        begin: () => {
          busyWaitMs(10)

          return { output: 'first' }
        },
      }
      const secondBusyType: WorkHandler = {
        kind: 'test.child',
        begin: () => {
          busyWaitMs(10)

          return { output: 'second' }
        },
      }
      const element = createParentElement(
        [createWorkTask('first', firstBusyType, {}), createWorkTask('second', secondBusyType, {})],
        { mode: 'concurrent' },
      )

      // Act
      const { traceSpan } = await executor.executeWithUnit(element, createContext())

      // Assert
      const slices = traceSpan.children
        .flatMap(child => child.executionSlices)
        .sort((a, b) => a.startedAtMs - b.startedAtMs)
      slices.forEach((slice, index) => {
        if (index > 0) {
          expect(slice.startedAtMs).toBeGreaterThanOrEqual(slices[index - 1].completedAtMs)
        }
      })
    })

    it('should report selfDurationMs as the sum of its execution slice widths', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const element = createOutputElement('child-1', 'done')

      // Act
      const { traceSpan } = await executor.executeWithUnit(element, createContext())

      // Assert
      const summedSliceWidths = traceSpan.executionSlices.reduce(
        (total, slice) => total + (slice.completedAtMs - slice.startedAtMs),
        0,
      )
      expect(traceSpan.selfDurationMs).toBe(summedSliceWidths)
    })
  })

  describe('executeSync()', () => {
    it('should run a fully synchronous tree without touching the microtask queue', () => {
      // Arrange
      const calls: string[] = []
      const executor = new WorkExecutor()
      const element = createParentElement(
        [createOutputElement('child-1', 'one', calls), createOutputElement('child-2', 'two', calls)],
        { mode: 'sequential' },
      )

      // Act
      const result = executor.executeSync(element, createContext())

      // Assert
      expect(calls).toEqual(['child-1', 'child-2'])
      expect(result.output).toEqual(['one', 'two'])
      expect(result.children.map(child => child.key)).toEqual(['child-1', 'child-2'])
    })

    it('should stop first-match children synchronously when the predicate matches', () => {
      // Arrange
      const calls: string[] = []
      const executor = new WorkExecutor()
      const element = createParentElement(
        [
          createOutputElement('child-1', 'continue', calls),
          createOutputElement('child-2', 'stop', calls),
          createOutputElement('child-3', 'skipped', calls),
        ],
        {
          mode: 'first-match',
          matches: completedWork => completedWork.output === 'stop',
        },
      )

      // Act
      const result = executor.executeSync(element, createContext())

      // Assert
      expect(calls).toEqual(['child-1', 'child-2'])
      expect(result.output).toEqual(['continue', 'stop'])
    })

    it('should fold synchronous concurrent children in declaration order', () => {
      // Arrange
      const calls: string[] = []
      const executor = new WorkExecutor()
      const element = createParentElement(
        [createOutputElement('child-1', 'one', calls), createOutputElement('child-2', 'two', calls)],
        { mode: 'concurrent' },
      )

      // Act
      const result = executor.executeSync(element, createContext())

      // Assert
      expect(calls).toEqual(['child-1', 'child-2'])
      expect(result.output).toEqual(['one', 'two'])
    })

    it('should throw when a handler suspends during synchronous execution', () => {
      // Arrange
      const executor = new WorkExecutor()
      const asyncType: WorkHandler = {
        kind: 'test.async',
        begin: async () => ({ output: 'late' }),
      }
      const element = createWorkTask('async-child', asyncType, {})

      // Act & Assert
      expect(() => executor.executeSync(element, createContext())).toThrow(
        'Synchronous execution encountered asynchronous work',
      )
    })

    it('should return the completed unit with executeSyncWithUnit', () => {
      // Arrange
      const executor = new WorkExecutor()
      const element = createOutputElement('child-1', 'done')

      // Act
      const result = executor.executeSyncWithUnit(element, createContext())

      // Assert
      expect(result.completedWork.output).toBe('done')
      expect(result.traceSpan.key).toBe('child-1')
      expect(result.traceSpan.completed).toBe(true)
      expect(result.traceSpan.executionSlices).toHaveLength(2)
    })

    it('should wrap an executeSyncWithUnit failure in a WorkExecutionError carrying the partial unit', () => {
      // Arrange
      const executor = new WorkExecutor()
      const error = new Error('begin failed')
      const type: WorkHandler = {
        kind: 'test.failure',
        begin: () => {
          throw error
        },
      }
      const element = createWorkTask('failed', type, {})

      // Act
      let thrown: unknown

      try {
        executor.executeSyncWithUnit(element, createContext())
      } catch (caught) {
        thrown = caught
      }

      // Assert
      expect(thrown).toBeInstanceOf(WorkExecutionError)
      if (!(thrown instanceof WorkExecutionError)) {
        throw new Error('expected a WorkExecutionError')
      }

      expect(thrown.original).toBe(error)
      expect(thrown.traceSpan.key).toBe('failed')
      expect(thrown.traceSpan.completed).toBe(false)
    })
  })
})
