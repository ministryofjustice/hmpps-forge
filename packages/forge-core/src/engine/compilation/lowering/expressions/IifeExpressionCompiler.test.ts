import { compileIifeExpression } from './IifeExpressionCompiler'

describe('compileIifeExpression()', () => {
  it('should compile a synchronous IIFE expression with parameters and arguments', () => {
    // Arrange
    const valueParam = 'value'

    // Act
    const source = compileIifeExpression({
      params: [valueParam],
      args: ['inputValue'],
      compileBody: emitter => {
        emitter.if(`${valueParam} === undefined`, () => {
          emitter.return('undefined')
        })

        emitter.return(`format(${valueParam})`)
      },
    })

    // Assert
    expect(source).toBe(
      [
        '(function(value) {',
        '  if (value === undefined) {',
        '    return undefined;',
        '  }',
        '  return format(value);',
        '})(inputValue)',
      ].join('\n'),
    )
  })

  it('should compile an awaited async IIFE expression when requested', () => {
    // Arrange
    const valueParam = 'value'

    // Act
    const source = compileIifeExpression({
      isAsync: true,
      awaitResult: true,
      params: [valueParam],
      args: ['inputValue'],
      compileBody: emitter => {
        emitter.return(`await format(${valueParam})`)
      },
    })

    // Assert
    expect(source).toBe(
      ['(await (async function(value) {', '  return await format(value);', '})(inputValue))'].join('\n'),
    )
  })
})
