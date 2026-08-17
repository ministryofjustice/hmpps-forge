import { code, positionedCode } from './fragments/CodeFragment'
import CodeGenerator from './CodeGenerator'
import IdentifierName from './fragments/IdentifierName'
import SourceRenderer from './rendering/SourceRenderer'
import { createCompiledFunction } from '../GeneratedFunctionCompiler'

describe('CodeGenerator', () => {
  describe('forFunction()', () => {
    it('should reserve parameter names before allocating generated locals', () => {
      // Arrange
      const generator = CodeGenerator.forFunction(['ctx'])

      // Act
      const local = generator.const('ctx', code`value`)

      // Assert
      expect(local.value).toBe('ctx_1')
    })
  })

  describe('const()', () => {
    it('should reuse lexical names in sibling scopes', () => {
      // Arrange
      const generator = new CodeGenerator()
      const names: IdentifierName[] = []

      // Act
      generator.if(
        code`left`,
        () => names.push(generator.const('answerHistory', code`leftValue`)),
        () => names.push(generator.const('answerHistory', code`rightValue`)),
      )

      // Assert
      expect(names.map(name => name.value)).toEqual(['answerHistory', 'answerHistory'])
      expect(new SourceRenderer().render(generator.toNodes()).source).toBe(
        [
          'if (left) {',
          '  const answerHistory = leftValue;',
          '}',
          'else {',
          '  const answerHistory = rightValue;',
          '}',
        ].join('\n'),
      )
    })
  })

  describe('function()', () => {
    it('should emit a named async function with an isolated function scope', () => {
      // Arrange
      const generator = new CodeGenerator()

      // Act
      const functionName = generator.function(
        'validate_contactPhone',
        ['fieldCode'],
        (functionGenerator, [fieldCode]) => {
          const result = functionGenerator.const('result', code`ctx.answers[${fieldCode}]`)

          functionGenerator.return(result)
        },
        { async: true },
      )
      generator.return(functionName)

      // Assert
      expect(functionName.value).toBe('validate_contactPhone')
      expect(new SourceRenderer().render(generator.toNodes()).source).toBe(
        [
          'async function validate_contactPhone(fieldCode) {',
          '  const result = ctx.answers[fieldCode];',
          '',
          '  return result;',
          '}',
          'return validate_contactPhone;',
        ].join('\n'),
      )
    })

    it('should reject strict-mode parameter bindings before rendering', () => {
      // Arrange
      const generator = new CodeGenerator()

      // Act
      const act = () => generator.function('validate', ['class'], () => undefined)

      // Assert
      expect(act).toThrow(/not a valid JavaScript identifier/)
    })
  })

  describe('functionExpression()', () => {
    it('should embed a structured named function without losing its body nodes', () => {
      // Arrange
      const generator = new CodeGenerator()

      // Act
      const run = generator.functionExpression(
        'validate_contactPhone',
        ['fieldCode'],
        (functionGenerator, [fieldCode]) => {
          functionGenerator.comment('ValidationCompiler.compileField')
          functionGenerator.return(code`ctx.answers[${fieldCode}]`)
        },
        { async: true },
      )

      generator.const('run', run)

      // Assert
      expect(new SourceRenderer().render(generator.toNodes()).source).toBe(
        [
          'const run = async function validate_contactPhone(fieldCode) {',
          '  // --- ValidationCompiler.compileField ---',
          '  return ctx.answers[fieldCode];',
          '};',
        ].join('\n'),
      )
    })
  })

  describe('tryCatch()', () => {
    it('should render structured control flow and reserve the catch binding', () => {
      // Arrange
      const generator = new CodeGenerator()

      // Act
      generator.tryCatch(
        () => generator.statement(code`risky()`),
        'error',
        error => {
          const fallback = generator.const('error', code`fallback`)

          generator.throw(code`wrap(${error}, ${fallback})`)
        },
      )

      // Assert
      expect(new SourceRenderer().render(generator.toNodes()).source).toBe(
        [
          'try {',
          '  risky();',
          '} catch (error) {',
          '  const error_1 = fallback;',
          '',
          '  throw wrap(error, error_1);',
          '}',
        ].join('\n'),
      )
    })
  })

  describe('source positions', () => {
    it('should render first-class position tokens as source-map segments', () => {
      // Arrange
      const generator = new CodeGenerator()
      const position = { file: '/journeys/steps.ts', line: 10, column: 14 }

      // Act
      generator.if(code`ready`, () => generator.statement(positionedCode(code`loadContent()`, [position])))
      const rendered = new SourceRenderer().render(generator.toNodes())

      // Assert
      expect(rendered.source).toBe(['if (ready) {', '  loadContent();', '}'].join('\n'))
      expect(rendered.segmentsByLine[1]).toEqual([{ generatedColumn: 2, position }])
    })

    it('should retain position chains through composed declaration code', () => {
      // Arrange
      const generator = new CodeGenerator()
      const helperPosition = { file: '/journeys/helpers.ts', line: 4, column: 2 }
      const authorPosition = { file: '/journeys/steps.ts', line: 10, column: 14 }

      // Act
      generator.const('result', positionedCode(code`evaluate()`, [helperPosition, authorPosition]))
      const rendered = new SourceRenderer().render(generator.toNodes())

      // Assert
      expect(rendered.source).toBe('const result = evaluate();')
      expect(rendered.segmentsByLine[0]).toEqual([
        { generatedColumn: 'const result = '.length, position: helperPosition },
        { generatedColumn: 'const result = '.length + 1, position: authorPosition },
      ])
    })

    it('should attach structural positions to function headers', () => {
      // Arrange
      const generator = new CodeGenerator()
      const position = { file: '/journeys/blocks.ts', line: 63, column: 41 }

      // Act
      generator.withSourcePositions([position], () => {
        generator.function('evaluate_contactPhone_0_IsRequired', [], functionGenerator => {
          functionGenerator.return(code`true`)
        })
      })
      const rendered = new SourceRenderer().render(generator.toNodes())

      // Assert
      expect(rendered.source).toBe(
        ['function evaluate_contactPhone_0_IsRequired() {', '  return true;', '}'].join('\n'),
      )
      expect(rendered.segmentsByLine[0]).toEqual([{ generatedColumn: 0, position }])
      expect(rendered.segmentsByLine[1]).toEqual([{ generatedColumn: 2, position }])
    })

    it('should compose nested structural positions from helper to author', () => {
      // Arrange
      const generator = new CodeGenerator()
      const authorPosition = { file: '/journeys/blocks.ts', line: 63, column: 41 }
      const helperPosition = { file: '/journeys/references.ts', line: 170, column: 14 }

      // Act
      generator.withSourcePositions([authorPosition], () => {
        generator.withSourcePositions([helperPosition], () => generator.statement(code`evaluate()`))
      })
      const rendered = new SourceRenderer().render(generator.toNodes())

      // Assert
      expect(rendered.source).toBe('evaluate();')
      expect(rendered.segmentsByLine[0]).toEqual([
        { generatedColumn: 0, position: helperPosition },
        { generatedColumn: 1, position: authorPosition },
      ])
    })
  })

  describe('comments', () => {
    it('should preserve breadcrumb spacing and comment every JavaScript line terminator', () => {
      // Arrange
      const generator = new CodeGenerator()

      // Act
      generator.statement(code`prepare()`)
      generator.comment('Compiler.compileField\rmalicious()\u2028throw new Error("escaped")')
      const rendered = new SourceRenderer().render(generator.toNodes())

      // Assert
      expect(rendered.source).toBe(
        [
          'prepare();',
          '',
          '// --- Compiler.compileField ---',
          '// --- malicious() ---',
          '// --- throw new Error("escaped") ---',
        ].join('\n'),
      )
      const compiled = createCompiledFunction(['prepare'], rendered.source, { usesAwait: false })

      expect(() => Reflect.apply(compiled, undefined, [() => undefined])).not.toThrow()
    })

    it('should not pad a generated function header before its first breadcrumb', () => {
      // Arrange
      const generator = new CodeGenerator()

      // Act
      generator.function('validate', [], functionGenerator => {
        functionGenerator.comment('ValidationCompiler.compileRule')
        functionGenerator.return(code`true`)
      })
      const rendered = new SourceRenderer().render(generator.toNodes())

      // Assert
      expect(rendered.source).toBe(
        ['function validate() {', '  // --- ValidationCompiler.compileRule ---', '  return true;', '}'].join('\n'),
      )
    })
  })
})
