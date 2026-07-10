import type { RequestTraceEvent } from '@ministryofjustice/hmpps-forge/core'
import { extractDevToolsCookie } from './devToolsCookie'

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

describe('devToolsCookie', () => {
  describe('extractDevToolsCookie()', () => {
    it('should return the value from parsed cookies when the devtools cookie is present there', () => {
      // Arrange
      const request = snapshot({ cookies: { __forgeDevtools: 'session-abc', other: 'x' } })

      // Act
      const value = extractDevToolsCookie(request)

      // Assert
      expect(value).toBe('session-abc')
    })

    it('should fall back to the raw cookie header when parsed cookies are absent', () => {
      // Arrange
      const request = snapshot({ headers: { cookie: 'other=x; __forgeDevtools=session-def; more=y' } })

      // Act
      const value = extractDevToolsCookie(request)

      // Assert
      expect(value).toBe('session-def')
    })

    it('should return undefined when neither parsed cookies nor the raw header carry the devtools cookie', () => {
      // Arrange
      const request = snapshot({ cookies: { other: 'x' }, headers: { cookie: 'other=x; more=y' } })

      // Act
      const value = extractDevToolsCookie(request)

      // Assert
      expect(value).toBeUndefined()
    })
  })
})
