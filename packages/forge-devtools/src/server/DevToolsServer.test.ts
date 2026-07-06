import type { RequestTraceEvent } from '@ministryofjustice/hmpps-forge/core'
import DevToolsServer from './DevToolsServer'

type Snapshot = RequestTraceEvent['snapshot']

function snapshot(overrides: Partial<Pick<Snapshot, 'cookies' | 'headers'>> = {}): Snapshot {
  return {
    nodeId: 'journey::step',
    method: 'GET',
    location: { origin: 'http://localhost', href: 'http://localhost/step', pathname: '/step', basePath: '' },
    params: {},
    query: {},
    post: {},
    headers: overrides.headers ?? {},
    cookies: overrides.cookies ?? {},
    state: {},
    session: {},
  }
}

function server(): DevToolsServer {
  return new DevToolsServer({ path: '/forge-devtools', logger: { info: () => {} } })
}

describe('DevToolsServer', () => {
  describe('shouldTrace()', () => {
    it('should return true when the snapshot carries the devtools cookie', () => {
      // Arrange
      const request = snapshot({ cookies: { __forgeDevtools: 'session-abc' } })

      // Act
      const result = server().shouldTrace(request)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when the snapshot does not carry the devtools cookie', () => {
      // Arrange
      const request = snapshot({ cookies: { other: 'x' } })

      // Act
      const result = server().shouldTrace(request)

      // Assert
      expect(result).toBe(false)
    })
  })
})
