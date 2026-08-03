import { captureCallsite, type Callsite } from '../../authoring/builders/utils/captureCallsite'
import { formatCallsite } from './formatCallsite'

describe('formatCallsite', () => {
  it('should return a parenthesised frame without the leading at', () => {
    // Arrange
    const callsite = { stack: 'Error\n    at journeySteps (/repo/journeys/tax/steps.ts:42:13)' }

    // Act
    const frame = formatCallsite(callsite)

    // Assert
    expect(frame).toBe('journeySteps (/repo/journeys/tax/steps.ts:42:13)')
  })

  it('should support anonymous frames without parentheses', () => {
    // Arrange
    const callsite = { stack: 'Error\n    at /repo/journeys/tax/steps.ts:42:13' }

    // Act
    const frame = formatCallsite(callsite)

    // Assert
    expect(frame).toBe('/repo/journeys/tax/steps.ts:42:13')
  })

  it('should never return the header line', () => {
    // Arrange
    const callsite = { stack: 'Error: something\n    at author (/repo/steps.ts:1:1)' }

    // Act
    const frame = formatCallsite(callsite)

    // Assert
    expect(frame).toBe('author (/repo/steps.ts:1:1)')
  })

  it('should skip internal frames in favour of the first author frame', () => {
    // Arrange
    const callsite = {
      stack: [
        'Error',
        '    at wrap (node:internal/modules/cjs/loader.js:10:5)',
        '    at run (/repo/node_modules/somelib/index.js:3:1)',
        '    at handle (/repo/packages/forge-core/src/registry/handles.ts:7:9)',
        '    at emit (/repo/packages/forge-core/dist/registry/handles.js:7:9)',
        '    at new Promise (<anonymous>)',
        '    at journeySteps (/repo/journeys/tax/steps.ts:42:13)',
      ].join('\n'),
    }

    // Act
    const frame = formatCallsite(callsite)

    // Assert
    expect(frame).toBe('journeySteps (/repo/journeys/tax/steps.ts:42:13)')
  })

  it('should fall back to the first frame when every frame is filtered', () => {
    // Arrange
    const callsite = {
      stack: [
        'Error',
        '    at handle (/repo/packages/forge-core/src/registry/handles.ts:7:9)',
        '    at run (/repo/node_modules/somelib/index.js:3:1)',
      ].join('\n'),
    }

    // Act
    const frame = formatCallsite(callsite)

    // Assert
    expect(frame).toBe('handle (/repo/packages/forge-core/src/registry/handles.ts:7:9)')
  })

  it('should return undefined for an undefined callsite', () => {
    // Act
    const frame = formatCallsite(undefined)

    // Assert
    expect(frame).toBeUndefined()
  })

  it('should return undefined when the callsite has no stack', () => {
    // Act
    const frame = formatCallsite({})

    // Assert
    expect(frame).toBeUndefined()
  })

  it('should return undefined for an empty-string stack', () => {
    // Act
    const frame = formatCallsite({ stack: '' })

    // Assert
    expect(frame).toBeUndefined()
  })

  it('should return undefined for a header-only stack', () => {
    // Act
    const frame = formatCallsite({ stack: 'Error' })

    // Assert
    expect(frame).toBeUndefined()
  })

  it('should format a real captured callsite to a frame in this file', () => {
    // Arrange
    const entry = (): Callsite => captureCallsite(entry)
    const site = entry()

    // Act
    const frame = formatCallsite(site)

    // Assert
    expect(frame).toContain('formatCallsite.test.ts')
  })
})
