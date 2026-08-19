import ForgeBaseError from './ForgeBaseError'
import ForgeInternalError from './ForgeInternalError'

class FakeForgeError extends ForgeBaseError {
  constructor(
    message: string,
    private readonly bodyStack?: string,
  ) {
    super(message)
  }

  protected override stackBodySource(): string | undefined {
    return this.bodyStack ?? super.stackBodySource()
  }
}

const INTERNAL_BODY_STACK = [
  'Error: boom',
  '    at author (/app/journeys/tax/steps.ts:42:13)',
  '    at helperOne (/repo/packages/forge-core/src/engine/chassis/work/WorkExecutor.ts:10:5)',
  '    at helperTwo (/repo/packages/forge-core/dist/engine/chassis/work/WorkExecutor.js:20:5)',
  '    at run (/repo/node_modules/somelib/index.js:3:1)',
  '    at outerAuthor (/app/journeys/tax/journey.ts:7:3)',
].join('\n')

describe('ForgeBaseError', () => {
  describe('stack', () => {
    it('should fold consecutive internal frames into one summary line per run', () => {
      // Arrange
      const error = new FakeForgeError('boom', INTERNAL_BODY_STACK)

      // Act
      const stack = error.stack

      // Assert
      expect(stack).toContain('FakeForgeError: boom')
      expect(stack).toContain('    at author (/app/journeys/tax/steps.ts:42:13)')
      expect(stack).toContain('    ... 3 forge frames (helperOne → run) — FORGE_FULL_STACK=1 to expand')
      expect(stack).toContain('    at outerAuthor (/app/journeys/tax/journey.ts:7:3)')
      expect(stack).not.toContain('    at helperOne')
    })

    it('should render a fold line that does not match the at-frame grammar', () => {
      // Arrange
      const error = new FakeForgeError('boom', INTERNAL_BODY_STACK)

      // Act
      const foldLine = error.stack?.split('\n').find(line => line.includes('forge frames'))

      // Assert
      expect(foldLine).toBeDefined()
      expect(foldLine).not.toMatch(/^\s+at /)
    })

    it('should fold forge compiled sourceURL frames into the same run as engine frames', () => {
      // Arrange
      const bodyStack = [
        'Error: boom',
        '    at author (/app/journeys/tax/steps.ts:42:13)',
        '    at helperOne (/repo/packages/forge-core/dist/engine/chassis/work/WorkExecutor.js:10:5)',
        '    at Object.run (forge:compiled/hooks:69:27)',
        '    at helperTwo (/repo/packages/forge-core/dist/engine/chassis/work/WorkExecutor.js:20:5)',
      ].join('\n')
      const error = new FakeForgeError('boom', bodyStack)

      // Act
      const stack = error.stack

      // Assert
      expect(stack).toContain('    ... 3 forge frames (helperOne → helperTwo) — FORGE_FULL_STACK=1 to expand')
      expect(stack).not.toContain('    at Object.run (forge:compiled/hooks:69:27)')
    })

    it('should use singular wording when a run folds a single frame', () => {
      // Arrange
      const bodyStack = [
        'Error: boom',
        '    at author (/app/journeys/tax/steps.ts:42:13)',
        '    at helperOne (/repo/packages/forge-core/src/engine/chassis/work/WorkExecutor.ts:10:5)',
        '    at outerAuthor (/app/journeys/tax/journey.ts:7:3)',
      ].join('\n')
      const error = new FakeForgeError('boom', bodyStack)

      // Act
      const stack = error.stack

      // Assert
      expect(stack).toContain('    ... 1 forge frame (helperOne) — FORGE_FULL_STACK=1 to expand')
    })

    it('should render every frame when FORGE_FULL_STACK is set', () => {
      // Arrange
      const error = new FakeForgeError('boom', INTERNAL_BODY_STACK)

      // Act
      process.env.FORGE_FULL_STACK = '1'
      const stack = error.stack
      delete process.env.FORGE_FULL_STACK

      // Assert
      expect(stack).toContain(
        '    at helperOne (/repo/packages/forge-core/src/engine/chassis/work/WorkExecutor.ts:10:5)',
      )
      expect(stack).not.toContain('forge frames (')
    })

    it('should allow hosts to overwrite the stack property', () => {
      // Arrange
      const error = new FakeForgeError('boom', INTERNAL_BODY_STACK)

      // Act
      error.stack = 'replaced'

      // Assert
      expect(error.stack).toBe('replaced')
    })
  })

  describe('rawStack', () => {
    it('should keep the unfolded frames reachable without mutating them', () => {
      // Arrange
      const error = new FakeForgeError('boom')

      // Act
      const { rawStack } = error

      // Assert
      expect(rawStack).toContain('FakeForgeError: boom')
      expect(rawStack).toContain('ForgeBaseError.test.ts')
      expect(rawStack).not.toContain('forge frames (')
    })

    it('should not appear as an enumerable property', () => {
      // Arrange
      const error = new FakeForgeError('boom')

      // Assert
      expect(Object.keys(error)).not.toContain('rawStack')
    })
  })

  describe('ForgeInternalError', () => {
    it('should never fold internal frames when the engine itself is broken', () => {
      // Arrange
      const error = new ForgeInternalError('invariant violated')

      // Act
      const stack = error.stack

      // Assert
      expect(stack).toContain('ForgeInternalError: invariant violated')
      expect(stack).not.toContain('forge frames (')
    })
  })
})
