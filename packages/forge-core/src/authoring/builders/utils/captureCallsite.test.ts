import { captureCallsite, stampCallsite, type Callsite } from './captureCallsite'

const callsiteOf = (value: unknown): Callsite | undefined =>
  Object.getOwnPropertyDescriptor(value, '__callsite')?.value as Callsite | undefined

describe('captureCallsite', () => {
  it('should capture a stack that names this file when read', () => {
    // Arrange
    const entry = (): Callsite => captureCallsite(entry)

    // Act
    const site = entry()

    // Assert
    expect(typeof site.stack).toBe('string')
    expect(site.stack).toContain('captureCallsite.test.ts')
  })

  it('should omit the skipped function and everything below it from the stack', () => {
    // Arrange
    const innerEntryPoint = (): Callsite => captureCallsite(innerEntryPoint)

    // Act
    const site = innerEntryPoint()

    // Assert
    expect(site.stack).not.toContain('innerEntryPoint')
    expect(site.stack).not.toContain('at captureCallsite')
  })

  it('should keep the outermost caller of a deep wrapper chain within the capture budget', () => {
    // Arrange
    const entry = (): Callsite => captureCallsite(entry)
    const wrap = (depth: number): Callsite => (depth === 0 ? entry() : wrap(depth - 1))
    const outermostWrapperCaller = (): Callsite => wrap(8)

    // Act
    const site = outermostWrapperCaller()

    // Assert
    expect(site.stack).toContain('outermostWrapperCaller')
  })

  it('should restore the stack trace limit after capturing', () => {
    // Arrange
    const previousLimit = Error.stackTraceLimit
    const entry = (): Callsite => captureCallsite(entry)

    // Act
    entry()

    // Assert
    expect(Error.stackTraceLimit).toBe(previousLimit)
  })
})

describe('stampCallsite', () => {
  it('should attach the callsite as a non-enumerable property', () => {
    // Arrange
    const entry = (): Callsite => captureCallsite(entry)
    const target: Record<string, unknown> = { code: 'firstName' }

    // Act
    stampCallsite(target, entry())

    // Assert
    expect(callsiteOf(target)?.stack).toContain('captureCallsite.test.ts')
    expect(Object.keys(target)).toEqual(['code'])
    expect(JSON.stringify(target)).not.toContain('__callsite')
  })

  it('should not stamp when the callsite is empty', () => {
    // Arrange
    const target = { code: 'firstName' }

    // Act
    stampCallsite(target, {})

    // Assert
    expect(callsiteOf(target)).toBeUndefined()
  })

  it('should ignore non-object targets', () => {
    // Arrange
    const entry = (): Callsite => captureCallsite(entry)

    // Act
    const act = () => stampCallsite('not an object', entry())

    // Assert
    expect(act).not.toThrow()
  })

  it('should allow an existing stamp to be overwritten', () => {
    // Arrange
    const entry = (): Callsite => captureCallsite(entry)
    const target = { code: 'firstName' }
    stampCallsite(target, entry())
    const replacement = entry()

    // Act
    stampCallsite(target, replacement)

    // Assert
    expect(callsiteOf(target)).toBe(replacement)
  })
})
