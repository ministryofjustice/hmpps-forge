import { code, fallbackPositionedCode, positionedCode } from './Code'
import CodeGenerator from './CodeGenerator'
import SourceRenderer, { GeneratedCodeStyle } from './SourceRenderer'

describe('SourceRenderer', () => {
  describe('render()', () => {
    it('should render structured control flow with indentation', () => {
      // Arrange
      const generator = new CodeGenerator()

      generator.if(code`condition`, () => {
        generator.scope(() => generator.statement(code`run()`))
      })

      // Act
      const rendered = new SourceRenderer().render(generator.toNodes())

      // Assert
      expect(rendered.source).toBe(['if (condition) {', '  {', '    run();', '  }', '}'].join('\n'))
    })

    it('should render structured try-catch nodes', () => {
      // Arrange
      const generator = new CodeGenerator()

      generator.tryCatch(
        () => generator.statement(code`risky()`),
        'error',
        error => generator.throw(code`wrap(${error})`),
      )

      // Act
      const rendered = new SourceRenderer().render(generator.toNodes())

      // Assert
      expect(rendered.source).toBe(['try {', '  risky();', '} catch (error) {', '  throw wrap(error);', '}'].join('\n'))
    })

    it('should record positioned expressions at indent-aware columns', () => {
      // Arrange
      const generator = new CodeGenerator()
      const position = { file: '/app/journeys/steps.ts', line: 12, column: 5 }

      generator.scope(() => generator.statement(positionedCode(code`evaluate()`, [position])))

      // Act
      const rendered = new SourceRenderer().render(generator.toNodes())

      // Assert
      expect(rendered.source).toBe(['{', '  evaluate();', '}'].join('\n'))
      expect(rendered.segmentsByLine[1]).toEqual([{ generatedColumn: 2, position }])
    })

    it('should nudge a position chain right so every frame remains bindable', () => {
      // Arrange
      const helperPosition = { file: '/app/helpers.ts', line: 3, column: 1 }
      const authorPosition = { file: '/app/journeys/steps.ts', line: 12, column: 5 }
      const generator = new CodeGenerator()

      generator.statement(positionedCode(code`evaluate()`, [helperPosition, authorPosition]))

      // Act
      const rendered = new SourceRenderer().render(generator.toNodes())

      // Assert
      expect(rendered.segmentsByLine[0].map(segment => segment.generatedColumn)).toEqual([0, 1])
    })

    it('should keep blank lines and comments in readable source', () => {
      // Arrange
      const generator = new CodeGenerator()

      generator.comment('compileBlock')
      generator.blank()
      generator.statement(code`run()`)

      // Act
      const rendered = new SourceRenderer({ style: GeneratedCodeStyle.READABLE }).render(generator.toNodes())

      // Assert
      expect(rendered.source).toBe(['// --- compileBlock ---', '', 'run();'].join('\n'))
    })

    it('should drop blanks, comments, and indentation in compact source', () => {
      // Arrange
      const generator = new CodeGenerator()

      generator.comment('compileBlock')
      generator.blank()
      generator.if(code`condition`, () => generator.statement(code`run()`))

      // Act
      const rendered = new SourceRenderer({ style: GeneratedCodeStyle.COMPACT }).render(generator.toNodes())

      // Assert
      expect(rendered.source).toBe(['if (condition) {', 'run();', '}'].join('\n'))
    })

    it('should scope sibling function positions independently', () => {
      // Arrange
      const generator = new CodeGenerator()
      const firstPosition = { file: '/app/journeys/validation-helper.ts', line: 8, column: 1 }
      const outerPosition = { file: '/app/journeys/validation.ts', line: 24, column: 3 }
      const first = positionedCode(
        generator.functionExpression('firstCallback', [], body => body.return(code`firstValue`)),
        [firstPosition],
      )
      const second = generator.functionExpression('secondCallback', [], body => body.return(code`secondValue`))
      const value = positionedCode(code`[${first}, ${second}]`, [outerPosition])

      // Act
      const rendered = new SourceRenderer().renderCode(value)
      const sourceLines = rendered.source.split('\n')
      const firstReturnLine = sourceLines.findIndex(lineText => lineText.includes('return firstValue;'))
      const secondReturnLine = sourceLines.findIndex(lineText => lineText.includes('return secondValue;'))

      // Assert
      expect(rendered.segmentsByLine[firstReturnLine]).toEqual([
        { generatedColumn: 2, position: firstPosition },
        { generatedColumn: 3, position: outerPosition },
      ])
      expect(rendered.segmentsByLine[secondReturnLine]).toEqual([{ generatedColumn: 2, position: outerPosition }])
    })

    it('should compose an explicit position before its inherited fallback without duplication', () => {
      // Arrange
      const innerPosition = { file: '/app/journeys/helper.ts', line: 7, column: 2 }
      const outerPosition = { file: '/app/journeys/definition.ts', line: 19, column: 4 }
      const value = fallbackPositionedCode(positionedCode(code`evaluate()`, [innerPosition]), [outerPosition])

      // Act
      const rendered = new SourceRenderer().renderCode(value)

      // Assert
      expect(rendered.segmentsByLine[0]).toEqual([
        { generatedColumn: 0, position: innerPosition },
        { generatedColumn: 1, position: outerPosition },
      ])
    })
  })
})
