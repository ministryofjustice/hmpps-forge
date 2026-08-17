import { captureCallsite, type Callsite } from '../../authoring/builders/utils/captureCallsite'
import { formatCallsite, formatCallsiteChain, resolveCallsitePositionChain } from './formatCallsite'

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

describe('resolveCallsitePositionChain', () => {
  it('should parse a single author frame into file, line, and column', () => {
    // Arrange
    const callsite = { stack: 'Error\n    at journeySteps (/repo/journeys/tax/steps.ts:42:13)' }

    // Act
    const chain = resolveCallsitePositionChain(callsite)

    // Assert
    expect(chain).toEqual([{ file: '/repo/journeys/tax/steps.ts', line: 42, column: 13 }])
  })

  it('should parse anonymous frames without parentheses', () => {
    // Arrange
    const callsite = { stack: 'Error\n    at /repo/journeys/tax/steps.ts:42:13' }

    // Act
    const chain = resolveCallsitePositionChain(callsite)

    // Assert
    expect(chain).toEqual([{ file: '/repo/journeys/tax/steps.ts', line: 42, column: 13 }])
  })

  it('should return the wiring line after the helper line when a shared helper built the node', () => {
    // Arrange
    const callsite = {
      stack: [
        'Error',
        '    at loadContent (/app/server/journeys/guide/effects.ts:56:14)',
        '    at definingSteps (/app/server/journeys/guide/sections/defining-steps/step.ts:10:14)',
      ].join('\n'),
    }

    // Act
    const chain = resolveCallsitePositionChain(callsite)

    // Assert
    expect(chain).toEqual([
      { file: '/app/server/journeys/guide/effects.ts', line: 56, column: 14 },
      { file: '/app/server/journeys/guide/sections/defining-steps/step.ts', line: 10, column: 14 },
    ])
  })

  it('should stop after the first frame from a different file', () => {
    // Arrange
    const callsite = {
      stack: [
        'Error',
        '    at helper (/repo/forms/content.ts:12:9)',
        '    at buildQuestions (/repo/forms/journey.ts:8:5)',
        '    at register (/repo/forms/app.ts:3:1)',
      ].join('\n'),
    }

    // Act
    const chain = resolveCallsitePositionChain(callsite)

    // Assert
    expect(chain.map(position => position.file)).toEqual(['/repo/forms/content.ts', '/repo/forms/journey.ts'])
  })

  it('should cap the chain at three positions within the capture file', () => {
    // Arrange
    const callsite = {
      stack: [
        'Error',
        '    at one (/repo/forms/content.ts:1:1)',
        '    at two (/repo/forms/content.ts:2:1)',
        '    at three (/repo/forms/content.ts:3:1)',
        '    at four (/repo/forms/content.ts:4:1)',
      ].join('\n'),
    }

    // Act
    const chain = resolveCallsitePositionChain(callsite)

    // Assert
    expect(chain.map(position => position.line)).toEqual([1, 2, 3])
  })

  it('should skip internal and bundler frames without ending the chain', () => {
    // Arrange
    const callsite = {
      stack: [
        'Error',
        '    at wrap (node:internal/modules/cjs/loader.js:10:5)',
        '    at handle (/repo/packages/forge-core/src/registry/handles.ts:7:9)',
        '    at __init (/app/dist/server.js:8:56)',
        '    at journeySteps (/app/server/forms/index.ts:40:12)',
      ].join('\n'),
    }

    // Act
    const chain = resolveCallsitePositionChain(callsite)

    // Assert
    expect(chain).toEqual([{ file: '/app/server/forms/index.ts', line: 40, column: 12 }])
  })

  it('should keep colons in Windows-style file paths', () => {
    // Arrange
    const callsite = { stack: 'Error\n    at steps (C:\\repo\\journeys\\steps.ts:5:3)' }

    // Act
    const chain = resolveCallsitePositionChain(callsite)

    // Assert
    expect(chain).toEqual([{ file: 'C:\\repo\\journeys\\steps.ts', line: 5, column: 3 }])
  })

  it('should drop unparseable frames while keeping the rest of the chain', () => {
    // Arrange
    const callsite = {
      stack: ['Error', '    at somewhere strange', '    at helper (/repo/forms/content.ts:12:9)'].join('\n'),
    }

    // Act
    const chain = resolveCallsitePositionChain(callsite)

    // Assert
    expect(chain).toEqual([{ file: '/repo/forms/content.ts', line: 12, column: 9 }])
  })

  it('should return an empty chain when every frame is internal', () => {
    // Arrange
    const callsite = {
      stack: [
        'Error',
        '    at handle (/repo/packages/forge-core/src/registry/handles.ts:7:9)',
        '    at run (/repo/node_modules/somelib/index.js:3:1)',
      ].join('\n'),
    }

    // Act & Assert
    expect(resolveCallsitePositionChain(callsite)).toEqual([])
  })

  it('should return an empty chain for missing, empty, or header-only stacks', () => {
    // Act & Assert
    expect(resolveCallsitePositionChain(undefined)).toEqual([])
    expect(resolveCallsitePositionChain({})).toEqual([])
    expect(resolveCallsitePositionChain({ stack: '' })).toEqual([])
    expect(resolveCallsitePositionChain({ stack: 'Error' })).toEqual([])
  })

  it('should return an empty chain for a real capture inside forge-core rather than falling back like the formatters', () => {
    // Arrange
    const entry = (): Callsite => captureCallsite(entry)
    const site = entry()

    // Act
    const chain = resolveCallsitePositionChain(site)

    // Assert
    expect(formatCallsite(site)).toContain('formatCallsite.test.ts')
    expect(chain).toEqual([])
  })
})
