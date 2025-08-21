import NumberTransformers from './numberTransformers'

describe('Number Transformers', () => {
  describe('Add', () => {
    const { evaluate } = NumberTransformers.Add.spec

    it('should add two positive numbers', () => {
      const result = evaluate(5, 3)
      expect(result).toBe(8)
    })

    it('should add negative numbers', () => {
      const result = evaluate(-5, -3)
      expect(result).toBe(-8)
    })

    it('should add positive and negative numbers', () => {
      const result = evaluate(5, -3)
      expect(result).toBe(2)
    })

    it('should handle decimals', () => {
      const result = evaluate(2.5, 1.3)
      expect(result).toBeCloseTo(3.8)
    })

    it('should throw error for non-number values', () => {
      expect(() => evaluate('5', 3)).toThrow('Transformer.Number.Add expects a number but received string.')
    })

    it('should return a function expression when called', () => {
      const expr = NumberTransformers.Add(5)
      expect(expr).toEqual({
        type: 'function',
        name: 'add',
        arguments: [5],
      })
    })
  })

  describe('Subtract', () => {
    const { evaluate } = NumberTransformers.Subtract.spec

    it('should subtract two positive numbers', () => {
      const result = evaluate(10, 3)
      expect(result).toBe(7)
    })

    it('should subtract negative numbers', () => {
      const result = evaluate(-5, -3)
      expect(result).toBe(-2)
    })

    it('should handle decimals', () => {
      const result = evaluate(5.7, 2.2)
      expect(result).toBeCloseTo(3.5)
    })

    it('should throw error for non-number values', () => {
      expect(() => evaluate('10', 3)).toThrow('Transformer.Number.Subtract expects a number but received string.')
    })
  })

  describe('Multiply', () => {
    const { evaluate } = NumberTransformers.Multiply.spec

    it('should multiply two positive numbers', () => {
      const result = evaluate(4, 3)
      expect(result).toBe(12)
    })

    it('should multiply by zero', () => {
      const result = evaluate(5, 0)
      expect(result).toBe(0)
    })

    it('should multiply negative numbers', () => {
      const result = evaluate(-4, -3)
      expect(result).toBe(12)
    })

    it('should handle decimals', () => {
      const result = evaluate(2.5, 4)
      expect(result).toBe(10)
    })

    it('should throw error for non-number values', () => {
      expect(() => evaluate('4', 3)).toThrow('Transformer.Number.Multiply expects a number but received string.')
    })
  })

  describe('Divide', () => {
    const { evaluate } = NumberTransformers.Divide.spec

    it('should divide two positive numbers', () => {
      const result = evaluate(15, 3)
      expect(result).toBe(5)
    })

    it('should handle decimals', () => {
      const result = evaluate(7.5, 2.5)
      expect(result).toBe(3)
    })

    it('should throw error for division by zero', () => {
      expect(() => evaluate(10, 0)).toThrow('Division by zero is not allowed in Transformer.Number.Divide')
    })

    it('should throw error for non-number values', () => {
      expect(() => evaluate('15', 3)).toThrow('Transformer.Number.Divide expects a number but received string.')
    })
  })

  describe('Abs', () => {
    const { evaluate } = NumberTransformers.Abs.spec

    it('should return absolute value of positive number', () => {
      const result = evaluate(5)
      expect(result).toBe(5)
    })

    it('should return absolute value of negative number', () => {
      const result = evaluate(-5)
      expect(result).toBe(5)
    })

    it('should handle zero', () => {
      const result = evaluate(0)
      expect(result).toBe(0)
    })

    it('should handle decimals', () => {
      const result = evaluate(-3.7)
      expect(result).toBe(3.7)
    })

    it('should throw error for non-number values', () => {
      expect(() => evaluate('-5')).toThrow('Transformer.Number.Abs expects a number but received string.')
    })
  })

  describe('Round', () => {
    const { evaluate } = NumberTransformers.Round.spec

    it('should round positive decimal down', () => {
      const result = evaluate(4.4)
      expect(result).toBe(4)
    })

    it('should round positive decimal up', () => {
      const result = evaluate(4.7)
      expect(result).toBe(5)
    })

    it('should round negative decimal', () => {
      const result = evaluate(-4.7)
      expect(result).toBe(-5)
    })

    it('should handle integers', () => {
      const result = evaluate(5)
      expect(result).toBe(5)
    })

    it('should throw error for non-number values', () => {
      expect(() => evaluate('4.7')).toThrow('Transformer.Number.Round expects a number but received string.')
    })
  })

  describe('Floor', () => {
    const { evaluate } = NumberTransformers.Floor.spec

    it('should floor positive decimal', () => {
      const result = evaluate(4.7)
      expect(result).toBe(4)
    })

    it('should floor negative decimal', () => {
      const result = evaluate(-4.2)
      expect(result).toBe(-5)
    })

    it('should handle integers', () => {
      const result = evaluate(5)
      expect(result).toBe(5)
    })

    it('should throw error for non-number values', () => {
      expect(() => evaluate('4.7')).toThrow('Transformer.Number.Floor expects a number but received string.')
    })
  })

  describe('Ceil', () => {
    const { evaluate } = NumberTransformers.Ceil.spec

    it('should ceiling positive decimal', () => {
      const result = evaluate(4.2)
      expect(result).toBe(5)
    })

    it('should ceiling negative decimal', () => {
      const result = evaluate(-4.7)
      expect(result).toBe(-4)
    })

    it('should handle integers', () => {
      const result = evaluate(5)
      expect(result).toBe(5)
    })

    it('should throw error for non-number values', () => {
      expect(() => evaluate('4.2')).toThrow('Transformer.Number.Ceil expects a number but received string.')
    })
  })

  describe('ToFixed', () => {
    const { evaluate } = NumberTransformers.ToFixed.spec

    it('should round to specified decimal places', () => {
      const result = evaluate(3.14159, 2)
      expect(result).toBe(3.14)
    })

    it('should handle zero decimal places', () => {
      const result = evaluate(3.7, 0)
      expect(result).toBe(4)
    })

    it('should add zeros when needed', () => {
      const result = evaluate(3, 2)
      expect(result).toBe(3.0)
    })

    it('should throw error for non-number values', () => {
      expect(() => evaluate('3.14', 2)).toThrow('Transformer.Number.ToFixed expects a number but received string.')
    })
  })

  describe('Max', () => {
    const { evaluate } = NumberTransformers.Max.spec

    it('should return maximum of two numbers', () => {
      const result = evaluate(5, 10)
      expect(result).toBe(10)
    })

    it('should return input when it is larger', () => {
      const result = evaluate(15, 10)
      expect(result).toBe(15)
    })

    it('should handle equal numbers', () => {
      const result = evaluate(5, 5)
      expect(result).toBe(5)
    })

    it('should handle negative numbers', () => {
      const result = evaluate(-5, -10)
      expect(result).toBe(-5)
    })

    it('should throw error for non-number values', () => {
      expect(() => evaluate('5', 10)).toThrow('Transformer.Number.Max expects a number but received string.')
    })
  })

  describe('Min', () => {
    const { evaluate } = NumberTransformers.Min.spec

    it('should return minimum of two numbers', () => {
      const result = evaluate(5, 10)
      expect(result).toBe(5)
    })

    it('should return comparison when it is smaller', () => {
      const result = evaluate(15, 10)
      expect(result).toBe(10)
    })

    it('should handle equal numbers', () => {
      const result = evaluate(5, 5)
      expect(result).toBe(5)
    })

    it('should handle negative numbers', () => {
      const result = evaluate(-5, -10)
      expect(result).toBe(-10)
    })

    it('should throw error for non-number values', () => {
      expect(() => evaluate('5', 10)).toThrow('Transformer.Number.Min expects a number but received string.')
    })
  })

  describe('Power', () => {
    const { evaluate } = NumberTransformers.Power.spec

    it('should raise number to power', () => {
      const result = evaluate(2, 3)
      expect(result).toBe(8)
    })

    it('should handle power of zero', () => {
      const result = evaluate(5, 0)
      expect(result).toBe(1)
    })

    it('should handle negative exponents', () => {
      const result = evaluate(2, -2)
      expect(result).toBe(0.25)
    })

    it('should throw error for non-number values', () => {
      expect(() => evaluate('2', 3)).toThrow('Transformer.Number.Power expects a number but received string.')
    })
  })

  describe('Sqrt', () => {
    const { evaluate } = NumberTransformers.Sqrt.spec

    it('should return square root of positive number', () => {
      const result = evaluate(16)
      expect(result).toBe(4)
    })

    it('should handle zero', () => {
      const result = evaluate(0)
      expect(result).toBe(0)
    })

    it('should handle decimals', () => {
      const result = evaluate(2.25)
      expect(result).toBe(1.5)
    })

    it('should throw error for negative numbers', () => {
      expect(() => evaluate(-4)).toThrow('Cannot calculate square root of negative number in Transformer.Number.Sqrt')
    })

    it('should throw error for non-number values', () => {
      expect(() => evaluate('16')).toThrow('Transformer.Number.Sqrt expects a number but received string.')
    })
  })

  describe('Clamp', () => {
    const { evaluate } = NumberTransformers.Clamp.spec

    it('should clamp value above maximum', () => {
      const result = evaluate(15, 5, 10)
      expect(result).toBe(10)
    })

    it('should clamp value below minimum', () => {
      const result = evaluate(3, 5, 10)
      expect(result).toBe(5)
    })

    it('should return value within range', () => {
      const result = evaluate(7, 5, 10)
      expect(result).toBe(7)
    })

    it('should handle value equal to bounds', () => {
      const result1 = evaluate(5, 5, 10)
      expect(result1).toBe(5)

      const result2 = evaluate(10, 5, 10)
      expect(result2).toBe(10)
    })

    it('should throw error for non-number values', () => {
      expect(() => evaluate('7', 5, 10)).toThrow('Transformer.Number.Clamp expects a number but received string.')
    })
  })
})
