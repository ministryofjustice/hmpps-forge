import { arrayCode, code, joinCode, literal, objectCode, positionedCode, propertyCode } from './Code'
import Name from './Name'
import PositionedCodeToken from './PositionedCodeToken'

describe('Code', () => {
  describe('code()', () => {
    it('should quote ordinary interpolations and preserve executable fragments', () => {
      // Arrange
      const variable = new Name('answer')
      const expression = code`ctx.answers${propertyCode('contact-phone')}`

      // Act
      const result = code`${variable} = ${expression} ?? ${'missing'};`

      // Assert
      expect(result.toString()).toBe('answer = ctx.answers["contact-phone"] ?? "missing";')
    })

    it('should compose joined fragments without quoting them', () => {
      // Arrange
      const values = [new Name('first'), literal('second'), literal(3)]

      // Act
      const result = code`run(${joinCode(values)});`

      // Assert
      expect(result.toString()).toBe('run(first, "second", 3);')
    })

    it('should compose typed arrays and objects', () => {
      // Arrange
      const answer = new Name('answer')

      // Act
      const result = objectCode([
        { key: 'field-code', value: literal('contactPhone') },
        { key: 'values', value: arrayCode([answer, literal(undefined)]) },
      ])

      // Assert
      expect(result.toString()).toBe('{ "field-code": "contactPhone", "values": [answer, undefined] }')
    })
  })

  describe('Name', () => {
    it('should reject an invalid JavaScript identifier', () => {
      // Act
      const act = () => new Name('contact-phone')

      // Assert
      expect(act).toThrow(/not a valid JavaScript identifier/)
    })

    it.each(['class', 'yield', 'eval', 'arguments'])('should reject the strict-mode binding name %s', name => {
      // Act
      const act = () => new Name(name)

      // Assert
      expect(act).toThrow(/not a valid JavaScript identifier/)
    })
  })

  describe('literal()', () => {
    it('should emit undefined and escape JavaScript line separators', () => {
      // Act
      const undefinedCode = literal(undefined)
      const stringCode = literal('first\u2028second\u2029third')

      // Assert
      expect(undefinedCode.toString()).toBe('undefined')
      expect(stringCode.toString()).toBe('"first\\u2028second\\u2029third"')
    })

    it('should reject values JSON cannot represent', () => {
      // Act
      const act = () => literal(Symbol('value'))

      // Assert
      expect(act).toThrow(/cannot be emitted as a literal/)
    })
  })

  describe('positionedCode()', () => {
    it('should retain positions as tokens without including them in source text', () => {
      // Arrange
      const position = { file: '/journeys/steps.ts', line: 12, column: 4 }

      // Act
      const result = positionedCode(code`evaluate()`, [position])

      // Assert
      expect(result.toString()).toBe('evaluate()')
      expect(result.items[0]).toBeInstanceOf(PositionedCodeToken)
      expect((result.items[0] as PositionedCodeToken).positions).toEqual([position])
      expect(Object.isFrozen(result.items)).toBe(true)
    })
  })
})
