import type { ResponseBindings } from '../../../../framework/types/responseBindings.type'
import RequestState from './RequestState'
import type { RuntimeContext } from '../../contracts/runtime/evaluationState.type'

describe('RequestState', () => {
  describe('functionRegistry', () => {
    it('should throw when read before context preparation records a registry', () => {
      // Arrange
      const requestState = new RequestState(createRuntimeContext(), {
        responseBindings: {} as ResponseBindings,
        functionBuilders: [],
        packageDependencies: {},
        hasRenderer: false,
        traceEnabled: false,
      })

      // Act
      const act = () => requestState.functionRegistry

      // Assert
      expect(act).toThrow('Function registry read before request context preparation')
    })
  })
})

function createRuntimeContext(): RuntimeContext {
  return {
    request: {
      url: '',
      path: '',
      method: '',
      location: { origin: '', href: '', pathname: '', basePath: '' },
      headers: {},
      cookies: {},
      state: {},
      params: {},
      query: {},
      post: {},
      session: {},
    },
    domain: { data: {}, answers: {} },
    evaluation: {},
  }
}
