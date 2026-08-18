import { RENDER_BLOCK_BRAND } from '../../concerns/render/contracts/renderBlock.brand'
import { FORGE_WORK } from '../contracts/work/work.type'
import type { CompletedWork, WorkHandler, WorkInstrumentation } from '../contracts/work/work.type'
import { createWorkTask, findChildByTask, isWorkTask, isWorkTaskOfKind } from './workTask'

const testWorkHandler: WorkHandler<'test', { readonly value: string }> = {
  kind: 'test',
  begin: ctx => ({ output: ctx.props.value }),
}

function completedChild(key: string, kind: string): CompletedWork {
  return { key, kind, output: undefined, children: [] }
}

describe('workTask', () => {
  describe('createWorkTask()', () => {
    it('should create a branded work task with key handler and props', () => {
      // Arrange
      const props = { value: 'done' }

      // Act
      const result = createWorkTask('work-1', testWorkHandler, props)

      // Assert
      expect(result).toEqual({
        $$typeof: Symbol.for('forge.work'),
        key: 'work-1',
        handler: testWorkHandler,
        props,
        instrumentation: undefined,
      })
      expect(result.$$typeof).toBe(FORGE_WORK)
    })

    it('should attach instrumentation when supplied', () => {
      // Arrange
      const props = { value: 'done' }
      const instrumentation: WorkInstrumentation<typeof props> = {
        resolveTraceMetadataAtStart: () => ({ phase: 'start' }),
        resolveTraceMetadataAtFinish: () => undefined,
      }

      // Act
      const result = createWorkTask('work-1', testWorkHandler, props, instrumentation)

      // Assert
      expect(result.instrumentation).toBe(instrumentation)
    })
  })

  describe('isWorkTask()', () => {
    it('should accept branded work tasks', () => {
      // Arrange
      const element = createWorkTask('work-1', testWorkHandler, { value: 'done' })

      // Act
      const result = isWorkTask(element)

      // Assert
      expect(result).toBe(true)
    })

    it('should reject unbranded and malformed values', () => {
      // Arrange
      const values = [
        undefined,
        null,
        'work',
        1,
        {},
        { $$typeof: FORGE_WORK, key: 'work-1', props: {} },
        { $$typeof: FORGE_WORK, handler: testWorkHandler, props: {} },
        { $$typeof: FORGE_WORK, key: 'work-1', handler: { kind: 'bad' }, props: {} },
        { [RENDER_BLOCK_BRAND]: true, key: 'resolve-block', handler: testWorkHandler, props: {} },
      ]

      // Act
      const results = values.map(value => isWorkTask(value))

      // Assert
      expect(results).toEqual(values.map(() => false))
    })
  })

  describe('isWorkTaskOfKind()', () => {
    it('should accept branded work tasks with the requested kind', () => {
      // Arrange
      const element = createWorkTask('work-1', testWorkHandler, { value: 'done' })

      // Act
      const result = isWorkTaskOfKind(element, 'test')

      // Assert
      expect(result).toBe(true)
    })

    it('should reject branded work tasks with another kind', () => {
      // Arrange
      const element = createWorkTask('work-1', testWorkHandler, { value: 'done' })

      // Act
      const result = isWorkTaskOfKind(element, 'other')

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('findChildByTask()', () => {
    it('should return the child matching the element key and kind', () => {
      // Arrange
      const element = createWorkTask('b', testWorkHandler, { value: 'x' })
      const children = [completedChild('a', 'test'), completedChild('b', 'test')]

      // Act
      const result = findChildByTask(children, element)

      // Assert
      expect(result).toBe(children[1])
    })

    it('should return undefined when no child matches the key', () => {
      // Arrange
      const element = createWorkTask('missing', testWorkHandler, { value: 'x' })
      const children = [completedChild('a', 'test')]

      // Act
      const result = findChildByTask(children, element)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should not match a child with the same key but a different kind', () => {
      // Arrange
      const element = createWorkTask('a', testWorkHandler, { value: 'x' })
      const children = [completedChild('a', 'other')]

      // Act
      const result = findChildByTask(children, element)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should not match a child with the same kind but a different key', () => {
      // Arrange
      const element = createWorkTask('a', testWorkHandler, { value: 'x' })
      const children = [completedChild('b', 'test')]

      // Act
      const result = findChildByTask(children, element)

      // Assert
      expect(result).toBeUndefined()
    })
  })
})
