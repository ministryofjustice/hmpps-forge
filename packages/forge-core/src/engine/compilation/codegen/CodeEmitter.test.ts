import CodeEmitter from './CodeEmitter'

describe('CodeEmitter', () => {
  describe('const()', () => {
    it('should reuse lexical names when declarations are in sibling scopes', () => {
      // Arrange
      const emitter = new CodeEmitter()
      const names: string[] = []

      // Act
      emitter.if(
        'left',
        () => names.push(emitter.const('answerHistory', 'leftValue')),
        () => names.push(emitter.const('answerHistory', 'rightValue')),
      )

      // Assert
      expect(names).toEqual(['answerHistory', 'answerHistory'])
      expect(emitter.toString()).toBe(
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

    it('should suffix lexical names when a visible declaration already uses the prefix', () => {
      // Arrange
      const emitter = new CodeEmitter()
      const names: string[] = []

      // Act
      names.push(emitter.const('answerHistory', 'outerValue'))
      emitter.if('left', () => names.push(emitter.const('answerHistory', 'leftValue')))
      emitter.if('right', () => names.push(emitter.const('answerHistory', 'rightValue')))

      // Assert
      expect(names).toEqual(['answerHistory', 'answerHistory_1', 'answerHistory_1'])
      expect(emitter.toString()).toBe(
        [
          'const answerHistory = outerValue;',
          'if (left) {',
          '  const answerHistory_1 = leftValue;',
          '}',
          'if (right) {',
          '  const answerHistory_1 = rightValue;',
          '}',
        ].join('\n'),
      )
    })
  })

  describe('ifChain()', () => {
    it('should emit a flat if else-if else chain with sibling branch scopes', () => {
      // Arrange
      const emitter = new CodeEmitter()
      const names: string[] = []

      // Act
      emitter.ifChain(
        [
          {
            condition: 'first',
            body: () => names.push(emitter.const('branchValue', '"first"')),
          },
          {
            condition: 'second',
            body: () => names.push(emitter.const('branchValue', '"second"')),
          },
        ],
        () => names.push(emitter.const('branchValue', '"fallback"')),
      )

      // Assert
      expect(names).toEqual(['branchValue', 'branchValue', 'branchValue'])
      expect(emitter.toString()).toBe(
        [
          'if (first) {',
          '  const branchValue = "first";',
          '}',
          'else if (second) {',
          '  const branchValue = "second";',
          '}',
          'else {',
          '  const branchValue = "fallback";',
          '}',
        ].join('\n'),
      )
    })

    it('should emit only the fallback body when no branches are provided', () => {
      // Arrange
      const emitter = new CodeEmitter()

      // Act
      emitter.ifChain([], () => {
        emitter.assign('value', '"fallback"')
      })

      // Assert
      expect(emitter.toString()).toBe('value = "fallback";')
    })
  })

  describe('tryCatch()', () => {
    it('should emit try catch blocks with sibling scopes', () => {
      // Arrange
      const emitter = new CodeEmitter()
      const names: string[] = []

      // Act
      emitter.tryCatch(
        () => names.push(emitter.const('result', 'readValue()')),
        'error',
        errorVar => {
          names.push(errorVar)
          names.push(emitter.const('result', 'fallbackValue'))
        },
      )

      // Assert
      expect(names).toEqual(['result', 'error', 'result'])
      expect(emitter.toString()).toBe(
        ['try {', '  const result = readValue();', '}', 'catch(error) {', '  const result = fallbackValue;', '}'].join(
          '\n',
        ),
      )
    })

    it('should reserve the catch binding name inside the catch block', () => {
      // Arrange
      const emitter = new CodeEmitter()
      const names: string[] = []

      // Act
      emitter.tryCatch(
        () => emitter.assign('value', 'readValue()'),
        'error',
        errorVar => {
          names.push(errorVar)
          names.push(emitter.const('error', 'fallbackValue'))
        },
      )

      // Assert
      expect(names).toEqual(['error', 'error_1'])
      expect(emitter.toString()).toBe(
        ['try {', '  value = readValue();', '}', 'catch(error) {', '  const error_1 = fallbackValue;', '}'].join('\n'),
      )
    })
  })

  describe('var()', () => {
    it('should suffix names when a visible lexical declaration already uses the prefix', () => {
      // Arrange
      const emitter = new CodeEmitter()

      // Act
      const lexicalName = emitter.const('answerHistory', 'outerValue')
      const functionName = emitter.var('answerHistory', 'fallbackValue')

      // Assert
      expect(lexicalName).toBe('answerHistory')
      expect(functionName).toBe('answerHistory_1')
      expect(emitter.toString()).toBe(
        ['const answerHistory = outerValue;', 'var answerHistory_1 = fallbackValue;'].join('\n'),
      )
    })

    it('should suffix names across sibling scopes because var is function scoped', () => {
      // Arrange
      const emitter = new CodeEmitter()
      const names: string[] = []

      // Act
      emitter.if('left', () => names.push(emitter.var('answerHistory', 'leftValue')))
      emitter.if('right', () => names.push(emitter.var('answerHistory', 'rightValue')))

      // Assert
      expect(names).toEqual(['answerHistory', 'answerHistory_1'])
      expect(emitter.toString()).toBe(
        [
          'if (left) {',
          '  var answerHistory = leftValue;',
          '}',
          'if (right) {',
          '  var answerHistory_1 = rightValue;',
          '}',
        ].join('\n'),
      )
    })
  })

  describe('declareVar()', () => {
    it('should emit fixed function scoped declarations when names are reserved directly', () => {
      // Arrange
      const emitter = new CodeEmitter()

      // Act
      emitter.declareVar('blocks', '[]')
      const redeclare = () => emitter.declareVar('blocks', '{}')

      // Assert
      expect(emitter.toString()).toBe('var blocks = [];')
      expect(redeclare).toThrow(/already declared/)
    })
  })

  describe('forRange()', () => {
    it('should reuse loop indexes when loops are in sibling scopes', () => {
      // Arrange
      const emitter = new CodeEmitter()
      const indexes: string[] = []

      // Act
      emitter.forRange('index', '0', 'items.length', index => {
        indexes.push(index)
        emitter.continue()
      })
      emitter.forRange('index', '0', 'values.length', index => {
        indexes.push(index)
        emitter.break()
      })

      // Assert
      expect(indexes).toEqual(['index', 'index'])
      expect(emitter.toString()).toBe(
        [
          'for (let index = 0; index < items.length; index++) {',
          '  continue;',
          '}',
          'for (let index = 0; index < values.length; index++) {',
          '  break;',
          '}',
        ].join('\n'),
      )
    })
  })

  describe('scope()', () => {
    it('should reuse lexical names when declarations are in sibling scopes', () => {
      // Arrange
      const emitter = new CodeEmitter()
      const names: string[] = []

      // Act
      emitter.scope(() => names.push(emitter.const('blockProps', '{}')))
      emitter.scope(() => names.push(emitter.const('blockProps', '{}')))

      // Assert
      expect(names).toEqual(['blockProps', 'blockProps'])
      expect(emitter.toString()).toBe(
        ['{', '  const blockProps = {};', '}', '{', '  const blockProps = {};', '}'].join('\n'),
      )
    })
  })

  describe('while()', () => {
    it('should emit a scoped while block', () => {
      // Arrange
      const emitter = new CodeEmitter()
      const names: string[] = []

      // Act
      emitter.while('index >= 0', () => {
        names.push(emitter.const('entry', 'items[index]'))
        emitter.break()
      })
      emitter.while('otherIndex >= 0', () => {
        names.push(emitter.const('entry', 'otherItems[otherIndex]'))
        emitter.continue()
      })

      // Assert
      expect(names).toEqual(['entry', 'entry'])
      expect(emitter.toString()).toBe(
        [
          'while (index >= 0) {',
          '  const entry = items[index];',
          '  break;',
          '}',
          'while (otherIndex >= 0) {',
          '  const entry = otherItems[otherIndex];',
          '  continue;',
          '}',
        ].join('\n'),
      )
    })
  })

  describe('code()', () => {
    it('should dedent multiline code when later lines share indentation', () => {
      // Arrange
      const emitter = new CodeEmitter()

      // Act
      emitter.code(`target.push({
        id: "one",
        value: result
      });`)

      // Assert
      expect(emitter.toString()).toBe(['target.push({', '  id: "one",', '  value: result', '});'].join('\n'))
    })

    it('should keep blank multiline code lines blank when emitting inside blocks', () => {
      // Arrange
      const emitter = new CodeEmitter()

      // Act
      emitter.if('condition', () => emitter.code('first();\n\nsecond();'))

      // Assert
      expect(emitter.toString()).toBe(['if (condition) {', '  first();', '', '  second();', '}'].join('\n'))
    })
  })

  describe('note()', () => {
    it('should emit a plain comment without a banner or forced blank line', () => {
      // Arrange
      const emitter = new CodeEmitter()

      // Act
      emitter.assign('value', 'readValue()')
      emitter.note('Explains the line below.')
      emitter.return('value')

      // Assert
      expect(emitter.toString()).toBe(
        ['value = readValue();', '// Explains the line below.', 'return value;'].join('\n'),
      )
    })
  })

  describe('comment()', () => {
    it('should emit line comments at the current indentation', () => {
      // Arrange
      const emitter = new CodeEmitter()

      // Act
      emitter.comment('StepResolveCompiler.compileBlock')
      emitter.if('condition', () => emitter.comment('StepResolveCompiler.compileFieldValueResolution'))

      // Assert
      expect(emitter.toString()).toBe(
        [
          '// --- StepResolveCompiler.compileBlock ---',
          'if (condition) {',
          '',
          '  // --- StepResolveCompiler.compileFieldValueResolution ---',
          '}',
        ].join('\n'),
      )
    })
  })

  describe('nextVar()', () => {
    it('should keep the legacy numbered variable sequence', () => {
      // Arrange
      const emitter = new CodeEmitter()

      // Act
      const first = emitter.nextVar('_value')
      const second = emitter.nextVar('_value')

      // Assert
      expect(first).toBe('_value0')
      expect(second).toBe('_value1')
    })
  })

  describe('syncVariablesFrom()', () => {
    it('should continue the legacy numbered sequence when a fork is synced', () => {
      // Arrange
      const emitter = new CodeEmitter()
      const fork = emitter.fork()

      // Act
      fork.nextVar('_value')
      fork.nextVar('_value')
      emitter.syncVariablesFrom(fork)

      // Assert
      expect(emitter.nextVar('_value')).toBe('_value2')
    })
  })
})
