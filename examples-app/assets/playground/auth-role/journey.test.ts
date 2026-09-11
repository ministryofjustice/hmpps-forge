import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { describe, expect, it } from 'vitest'
import patternPackage from './journey'

const createClient = () => new ForgeTestHarness().registerPackage(patternPackage).createClient()

describe('authRoleDemoJourney', () => {
  it.each(['dashboard', 'admin-panel'])('should redirect to login when an unauthenticated visitor opens %s', async route => {
    // Arrange
    const client = createClient()

    // Act
    const result = await client.get(`/auth-role/${route}`, { session: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/auth-role/login' })
  })

  it('should allow the admin panel when the visitor logs in as admin', async () => {
    // Arrange
    const client = createClient()
    const session = {}

    // Act
    const login = await client.post('/auth-role/login', { session, body: { action: 'login-admin' } })
    const panel = await client.get('/auth-role/admin-panel', { session })

    // Assert
    expect(login).toMatchObject({ type: 'redirect', url: '/auth-role/dashboard' })
    expect(session).toEqual({ demoUser: { name: 'Demo Admin', role: 'admin' } })
    expect(panel).toMatchObject({ type: 'render', context: { step: { code: 'admin-panel' } } })
  })

  it('should return a forbidden error when a viewer opens the admin panel', async () => {
    // Arrange
    const client = createClient()
    const session = { demoUser: { name: 'Demo Viewer', role: 'viewer' } }

    // Act
    const result = await client.get('/auth-role/admin-panel', { session })

    // Assert
    expect(result).toMatchObject({ type: 'error', error: {
      status: 403,
      message: 'You do not have permission to access this page',
    } })
  })

  it('should deny protected routes when the visitor logs out', async () => {
    // Arrange
    const client = createClient()
    const session = { demoUser: { name: 'Demo Admin', role: 'admin' } }

    // Act
    const logout = await client.post('/auth-role/dashboard', { session, body: { action: 'logout' } })
    const dashboard = await client.get('/auth-role/dashboard', { session })

    // Assert
    expect(session).toEqual({})
    expect(logout).toMatchObject({ type: 'redirect', url: '/auth-role/login' })
    expect(dashboard).toMatchObject({ type: 'redirect', url: '/auth-role/login' })
  })
})
