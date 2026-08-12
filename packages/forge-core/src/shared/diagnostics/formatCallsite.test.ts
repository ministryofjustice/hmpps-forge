import { captureCallsite, type Callsite } from '../../authoring/builders/utils/captureCallsite'
import { formatCallsite, formatCallsiteChain } from './formatCallsite'

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

  it('should return one entry from formatCallsiteChain for an unwrapped callsite', () => {
    // Arrange
    const callsite = { stack: 'Error\n    at journeySteps (/repo/journeys/tax/steps.ts:42:13)' }

    // Act
    const chain = formatCallsiteChain(callsite)

    // Assert
    expect(chain).toEqual(['journeySteps (/repo/journeys/tax/steps.ts:42:13)'])
  })

  it('should walk past wrapper frames in the capture file and stop at the first frame in another file', () => {
    // Arrange
    const callsite = {
      stack: [
        'Error',
        '    at radioField (/repo/app/forms/questionContent.ts:12:9)',
        '    at revealedQuestion (/repo/app/forms/questionContent.ts:30:11)',
        '    at buildQuestions (/repo/app/forms/assessment/questions.ts:8:5)',
        '    at registerJourney (/repo/app/forms/assessment/journey.ts:3:1)',
      ].join('\n'),
    }

    // Act
    const chain = formatCallsiteChain(callsite)

    // Assert
    expect(chain).toEqual([
      'radioField (/repo/app/forms/questionContent.ts:12:9)',
      'revealedQuestion (/repo/app/forms/questionContent.ts:30:11)',
      'buildQuestions (/repo/app/forms/assessment/questions.ts:8:5)',
    ])
  })

  it('should cap the chain at three entries even within the capture file', () => {
    // Arrange
    const callsite = {
      stack: [
        'Error',
        '    at one (/repo/app/forms/questionContent.ts:1:1)',
        '    at two (/repo/app/forms/questionContent.ts:2:1)',
        '    at three (/repo/app/forms/questionContent.ts:3:1)',
        '    at four (/repo/app/forms/questionContent.ts:4:1)',
      ].join('\n'),
    }

    // Act
    const chain = formatCallsiteChain(callsite)

    // Assert
    expect(chain).toHaveLength(3)
    expect(chain[2]).toBe('three (/repo/app/forms/questionContent.ts:3:1)')
  })

  it('should skip native and internal frames without ending the chain', () => {
    // Arrange
    const callsite = {
      stack: [
        'Error',
        '    at radioField (/repo/app/forms/questionContent.ts:12:9)',
        '    at Array.map (<anonymous>)',
        '    at handle (/repo/packages/forge-core/src/registry/handles.ts:7:9)',
        '    at buildQuestions (/repo/app/forms/assessment/questions.ts:8:5)',
      ].join('\n'),
    }

    // Act
    const chain = formatCallsiteChain(callsite)

    // Assert
    expect(chain).toEqual([
      'radioField (/repo/app/forms/questionContent.ts:12:9)',
      'buildQuestions (/repo/app/forms/assessment/questions.ts:8:5)',
    ])
  })

  it('should skip bundler module-wiring helper frames without ending the chain', () => {
    // Arrange
    const callsite = {
      stack: [
        'Error',
        '    at journeySteps (/app/server/forms/index.ts:40:40)',
        '    at __init (/app/dist/server.js:8:56)',
        '    at __require (/app/dist/server.js:12:50)',
      ].join('\n'),
    }

    // Act
    const chain = formatCallsiteChain(callsite)

    // Assert
    expect(chain).toEqual(['journeySteps (/app/server/forms/index.ts:40:40)'])
  })

  it('should collapse a module-named frame to its bare location', () => {
    // Arrange
    const callsite = {
      stack: [
        'Error',
        '    at server/forms/index.ts (/app/server/forms/index.ts:40:40)',
        '    at register (/app/server/app.ts:7:3)',
      ].join('\n'),
    }

    // Act
    const chain = formatCallsiteChain(callsite)

    // Assert
    expect(chain).toEqual(['/app/server/forms/index.ts:40:40', 'register (/app/server/app.ts:7:3)'])
  })

  it('should treat forge compiled sourceURL frames as internal', () => {
    // Arrange
    const callsite = {
      stack: [
        'Error',
        '    at Object.run (forge:compiled/hooks:69:27)',
        '    at journeySteps (/app/server/forms/index.ts:40:40)',
      ].join('\n'),
    }

    // Act
    const chain = formatCallsiteChain(callsite)

    // Assert
    expect(chain).toEqual(['journeySteps (/app/server/forms/index.ts:40:40)'])
  })

  it('should fall back to the first frame from formatCallsiteChain when every frame is internal', () => {
    // Arrange
    const callsite = {
      stack: [
        'Error',
        '    at handle (/repo/packages/forge-core/src/registry/handles.ts:7:9)',
        '    at run (/repo/node_modules/somelib/index.js:3:1)',
      ].join('\n'),
    }

    // Act
    const chain = formatCallsiteChain(callsite)

    // Assert
    expect(chain).toEqual(['handle (/repo/packages/forge-core/src/registry/handles.ts:7:9)'])
  })

  it('should return an empty chain when the callsite has no frames', () => {
    // Act & Assert
    expect(formatCallsiteChain(undefined)).toEqual([])
    expect(formatCallsiteChain({})).toEqual([])
    expect(formatCallsiteChain({ stack: 'Error' })).toEqual([])
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
