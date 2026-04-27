/* eslint-disable no-new-func */
import FormatNodeCompiler from './FormatNodeCompiler'
import { NodeCompilationContext } from './types'

function createCompiler(): FormatNodeCompiler {
  const ctx: NodeCompilationContext = {
    compileOperand: (value: unknown) => JSON.stringify(value),
    compileFunctionCall: (funcName: string, argExprs: string[]) => `${funcName}(${argExprs.join(', ')})`,
    namespaceToCtx: (namespace: string) => `ctx.${namespace}`,
    iteratorStack: [],
  }

  return new FormatNodeCompiler(ctx)
}

function evaluateCompiledExpression(source: string): unknown {
  return new Function(`return ${source}`)()
}

describe('FormatNodeCompiler', () => {
  describe('compile()', () => {
    it('should replace repeated placeholders with the same argument', () => {
      // Arrange
      const compiler = createCompiler()
      const source = compiler.compile({
        template: '%1 sent %1 a message',
        arguments: ['Ada'],
      })

      // Act
      const result = evaluateCompiledExpression(source)

      // Assert
      expect(result).toBe('Ada sent Ada a message')
    })

    it('should not replace a two-digit placeholder when replacing a shorter placeholder', () => {
      // Arrange
      const compiler = createCompiler()
      const source = compiler.compile({
        template: '%1 / %10 / %1',
        arguments: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
      })

      // Act
      const result = evaluateCompiledExpression(source)

      // Assert
      expect(result).toBe('A / J / A')
    })

    it('should not interpret replacement values as String.replace tokens', () => {
      // Arrange
      const compiler = createCompiler()
      const source = compiler.compile({
        template: '%1 then %1',
        arguments: ['$&'],
      })

      // Act
      const result = evaluateCompiledExpression(source)

      // Assert
      expect(result).toBe('$& then $&')
    })
  })
})
