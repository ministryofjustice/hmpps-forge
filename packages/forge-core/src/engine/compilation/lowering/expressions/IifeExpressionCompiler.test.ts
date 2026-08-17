import { code, literal } from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import SourceRenderer from '../codegen/rendering/SourceRenderer'
import { compileIifeExpression } from './IifeExpressionCompiler'

describe('compileIifeExpression()', () => {
  it('should compile a synchronous IIFE expression with parameters and arguments', () => {
    // Arrange
    const valueParam = 'value'
    const generator = new CodeGenerator()

    // Act
    const source = compileIifeExpression({
      generator,
      params: [valueParam],
      args: [code`inputValue`],
      compileBody: (functionGenerator, [value]) => {
        functionGenerator.if(code`${value} === undefined`, () => {
          functionGenerator.return(literal(undefined))
        })

        functionGenerator.return(code`format(${value})`)
      },
    })
    const rendered = new SourceRenderer().renderCode(source).source

    // Assert
    expect(rendered).toBe(
      [
        '(function evaluate_expression(value) {',
        '  if (value === undefined) {',
        '    return undefined;',
        '  }',
        '',
        '  return format(value);',
        '})(inputValue)',
      ].join('\n'),
    )
  })

  it('should compile an awaited async IIFE expression when requested', () => {
    // Arrange
    const valueParam = 'value'
    const generator = new CodeGenerator()

    // Act
    const source = compileIifeExpression({
      generator,
      isAsync: true,
      awaitResult: true,
      params: [valueParam],
      args: [code`inputValue`],
      compileBody: (functionGenerator, [value]) => {
        functionGenerator.return(code`await format(${value})`)
      },
    })
    const rendered = new SourceRenderer().renderCode(source).source

    // Assert
    expect(rendered).toBe(
      ['(await (async function evaluate_expression(value) {', '  return await format(value);', '})(inputValue))'].join(
        '\n',
      ),
    )
  })
})
