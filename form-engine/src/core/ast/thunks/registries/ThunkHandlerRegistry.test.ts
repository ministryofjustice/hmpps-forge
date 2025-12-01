import { NodeId } from '@form-engine/core/types/engine.type'
import { ThunkHandler, ThunkResult } from '../types'
import ThunkHandlerRegistry from './ThunkHandlerRegistry'

const createHandler = (id: NodeId): ThunkHandler => ({
  nodeId: id,
  async evaluate() {
    const result: ThunkResult = {
      value: id,
      metadata: {
        source: 'ThunkHandlerRegistry.test',
        timestamp: Date.now(),
      },
    }

    return result
  },
})

describe('ThunkHandlerRegistry', () => {
  describe('clone', () => {
    it('copies all registered handlers', () => {
      const registry = new ThunkHandlerRegistry()
      const handlerId: NodeId = 'compile_pseudo:1'

      registry.register(handlerId, createHandler(handlerId))

      const cloned = registry.clone()

      expect(cloned.size()).toBe(registry.size())
      expect(cloned.has(handlerId)).toBe(true)
      expect(cloned.get(handlerId)).toBe(registry.get(handlerId))
    })

    it('returns an independent registry copy', () => {
      const registry = new ThunkHandlerRegistry()
      const baseHandlerId: NodeId = 'compile_pseudo:2'

      registry.register(baseHandlerId, createHandler(baseHandlerId))

      const cloned = registry.clone()
      const runtimeHandlerId: NodeId = 'runtime_pseudo:1'

      cloned.register(runtimeHandlerId, createHandler(runtimeHandlerId))

      expect(registry.has(runtimeHandlerId)).toBe(false)

      const newOriginalHandlerId: NodeId = 'compile_pseudo:3'
      registry.register(newOriginalHandlerId, createHandler(newOriginalHandlerId))

      expect(cloned.has(newOriginalHandlerId)).toBe(false)
    })
  })
})
