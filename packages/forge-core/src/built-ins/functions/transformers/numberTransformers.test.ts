import { NumberTransformers, numberTransformersRegistry } from './numberTransformers'
import { FunctionType } from '../../../authoring/types/enums'
import { FunctionRegistryTestHarness } from '../../../testing/functions/FunctionRegistryTestHarness'

describe('Number Transformers', () => {
  const harness = new FunctionRegistryTestHarness(numberTransformersRegistry)

  describe('Add', () => {
    it('should add two positive numbers', () => {
      const result = harness.evaluate(NumberTransformers.Add(3)).withInput(5)
      expect(result).toBe(8)
    })

    it('should add negative numbers', () => {
      const result = harness.evaluate(NumberTransformers.Add(-3)).withInput(-5)
      expect(result).toBe(-8)
    })

    it('should add positive and negative numbers', () => {
      const result = harness.evaluate(NumberTransformers.Add(-3)).withInput(5)
      expect(result).toBe(2)
    })

    it('should handle decimals', () => {
      const result = harness.evaluate(NumberTransformers.Add(1.3)).withInput(2.5)
      expect(result).toBeCloseTo(3.8)
    })

    it('should throw error for non-number values', () => {
      expect(() => harness.evaluate(NumberTransformers.Add(3)).withInput('5')).toThrow(
        'Number.Add: value failed schema validation',
      )
    })

    it('should return a function expression when called', () => {
      const expr = NumberTransformers.Add(5)
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'Number.Add',
        arguments: [5],
      })
    })
  })

  describe('Subtract', () => {
    it('should subtract two positive numbers', () => {
      const result = harness.evaluate(NumberTransformers.Subtract(3)).withInput(10)
      expect(result).toBe(7)
    })

    it('should subtract negative numbers', () => {
      const result = harness.evaluate(NumberTransformers.Subtract(-3)).withInput(-5)
      expect(result).toBe(-2)
    })

    it('should handle decimals', () => {
      const result = harness.evaluate(NumberTransformers.Subtract(2.2)).withInput(5.7)
      expect(result).toBeCloseTo(3.5)
    })

    it('should throw error for non-number values', () => {
      expect(() => harness.evaluate(NumberTransformers.Subtract(3)).withInput('10')).toThrow(
        'Number.Subtract: value failed schema validation',
      )
    })
  })

  describe('Multiply', () => {
    it('should multiply two positive numbers', () => {
      const result = harness.evaluate(NumberTransformers.Multiply(3)).withInput(4)
      expect(result).toBe(12)
    })

    it('should multiply by zero', () => {
      const result = harness.evaluate(NumberTransformers.Multiply(0)).withInput(5)
      expect(result).toBe(0)
    })

    it('should multiply negative numbers', () => {
      const result = harness.evaluate(NumberTransformers.Multiply(-3)).withInput(-4)
      expect(result).toBe(12)
    })

    it('should handle decimals', () => {
      const result = harness.evaluate(NumberTransformers.Multiply(4)).withInput(2.5)
      expect(result).toBe(10)
    })

    it('should throw error for non-number values', () => {
      expect(() => harness.evaluate(NumberTransformers.Multiply(3)).withInput('4')).toThrow(
        'Number.Multiply: value failed schema validation',
      )
    })
  })

  describe('Divide', () => {
    it('should divide two positive numbers', () => {
      const result = harness.evaluate(NumberTransformers.Divide(3)).withInput(15)
      expect(result).toBe(5)
    })

    it('should handle decimals', () => {
      const result = harness.evaluate(NumberTransformers.Divide(2.5)).withInput(7.5)
      expect(result).toBe(3)
    })

    it('should throw error for division by zero', () => {
      expect(() => harness.evaluate(NumberTransformers.Divide(0)).withInput(10)).toThrow(
        'Division by zero is not allowed in Transformer.Number.Divide',
      )
    })

    it('should throw error for non-number values', () => {
      expect(() => harness.evaluate(NumberTransformers.Divide(3)).withInput('15')).toThrow(
        'Number.Divide: value failed schema validation',
      )
    })
  })

  describe('Abs', () => {
    it('should return absolute value of positive number', () => {
      const result = harness.evaluate(NumberTransformers.Abs()).withInput(5)
      expect(result).toBe(5)
    })

    it('should return absolute value of negative number', () => {
      const result = harness.evaluate(NumberTransformers.Abs()).withInput(-5)
      expect(result).toBe(5)
    })

    it('should handle zero', () => {
      const result = harness.evaluate(NumberTransformers.Abs()).withInput(0)
      expect(result).toBe(0)
    })

    it('should handle decimals', () => {
      const result = harness.evaluate(NumberTransformers.Abs()).withInput(-3.7)
      expect(result).toBe(3.7)
    })

    it('should throw error for non-number values', () => {
      expect(() => harness.evaluate(NumberTransformers.Abs()).withInput('-5')).toThrow(
        'Number.Abs: value failed schema validation',
      )
    })
  })

  describe('Round', () => {
    it('should round positive decimal down', () => {
      const result = harness.evaluate(NumberTransformers.Round()).withInput(4.4)
      expect(result).toBe(4)
    })

    it('should round positive decimal up', () => {
      const result = harness.evaluate(NumberTransformers.Round()).withInput(4.7)
      expect(result).toBe(5)
    })

    it('should round negative decimal', () => {
      const result = harness.evaluate(NumberTransformers.Round()).withInput(-4.7)
      expect(result).toBe(-5)
    })

    it('should handle integers', () => {
      const result = harness.evaluate(NumberTransformers.Round()).withInput(5)
      expect(result).toBe(5)
    })

    it('should throw error for non-number values', () => {
      expect(() => harness.evaluate(NumberTransformers.Round()).withInput('4.7')).toThrow(
        'Number.Round: value failed schema validation',
      )
    })
  })

  describe('Floor', () => {
    it('should floor positive decimal', () => {
      const result = harness.evaluate(NumberTransformers.Floor()).withInput(4.7)
      expect(result).toBe(4)
    })

    it('should floor negative decimal', () => {
      const result = harness.evaluate(NumberTransformers.Floor()).withInput(-4.2)
      expect(result).toBe(-5)
    })

    it('should handle integers', () => {
      const result = harness.evaluate(NumberTransformers.Floor()).withInput(5)
      expect(result).toBe(5)
    })

    it('should throw error for non-number values', () => {
      expect(() => harness.evaluate(NumberTransformers.Floor()).withInput('4.7')).toThrow(
        'Number.Floor: value failed schema validation',
      )
    })
  })

  describe('Ceil', () => {
    it('should ceiling positive decimal', () => {
      const result = harness.evaluate(NumberTransformers.Ceil()).withInput(4.2)
      expect(result).toBe(5)
    })

    it('should ceiling negative decimal', () => {
      const result = harness.evaluate(NumberTransformers.Ceil()).withInput(-4.7)
      expect(result).toBe(-4)
    })

    it('should handle integers', () => {
      const result = harness.evaluate(NumberTransformers.Ceil()).withInput(5)
      expect(result).toBe(5)
    })

    it('should throw error for non-number values', () => {
      expect(() => harness.evaluate(NumberTransformers.Ceil()).withInput('4.2')).toThrow(
        'Number.Ceil: value failed schema validation',
      )
    })
  })

  describe('ToFixed', () => {
    it('should round to specified decimal places', () => {
      const result = harness.evaluate(NumberTransformers.ToFixed(2)).withInput(3.14159)
      expect(result).toBe(3.14)
    })

    it('should handle zero decimal places', () => {
      const result = harness.evaluate(NumberTransformers.ToFixed(0)).withInput(3.7)
      expect(result).toBe(4)
    })

    it('should add zeros when needed', () => {
      const result = harness.evaluate(NumberTransformers.ToFixed(2)).withInput(3)
      expect(result).toBe(3.0)
    })

    it('should throw error for non-number values', () => {
      expect(() => harness.evaluate(NumberTransformers.ToFixed(2)).withInput('3.14')).toThrow(
        'Number.ToFixed: value failed schema validation',
      )
    })
  })

  describe('Max', () => {
    it('should return maximum of two numbers', () => {
      const result = harness.evaluate(NumberTransformers.Max(10)).withInput(5)
      expect(result).toBe(10)
    })

    it('should return input when it is larger', () => {
      const result = harness.evaluate(NumberTransformers.Max(10)).withInput(15)
      expect(result).toBe(15)
    })

    it('should handle equal numbers', () => {
      const result = harness.evaluate(NumberTransformers.Max(5)).withInput(5)
      expect(result).toBe(5)
    })

    it('should handle negative numbers', () => {
      const result = harness.evaluate(NumberTransformers.Max(-10)).withInput(-5)
      expect(result).toBe(-5)
    })

    it('should throw error for non-number values', () => {
      expect(() => harness.evaluate(NumberTransformers.Max(10)).withInput('5')).toThrow(
        'Number.Max: value failed schema validation',
      )
    })
  })

  describe('Min', () => {
    it('should return minimum of two numbers', () => {
      const result = harness.evaluate(NumberTransformers.Min(10)).withInput(5)
      expect(result).toBe(5)
    })

    it('should return comparison when it is smaller', () => {
      const result = harness.evaluate(NumberTransformers.Min(10)).withInput(15)
      expect(result).toBe(10)
    })

    it('should handle equal numbers', () => {
      const result = harness.evaluate(NumberTransformers.Min(5)).withInput(5)
      expect(result).toBe(5)
    })

    it('should handle negative numbers', () => {
      const result = harness.evaluate(NumberTransformers.Min(-10)).withInput(-5)
      expect(result).toBe(-10)
    })

    it('should throw error for non-number values', () => {
      expect(() => harness.evaluate(NumberTransformers.Min(10)).withInput('5')).toThrow(
        'Number.Min: value failed schema validation',
      )
    })
  })

  describe('Power', () => {
    it('should raise number to power', () => {
      const result = harness.evaluate(NumberTransformers.Power(3)).withInput(2)
      expect(result).toBe(8)
    })

    it('should handle power of zero', () => {
      const result = harness.evaluate(NumberTransformers.Power(0)).withInput(5)
      expect(result).toBe(1)
    })

    it('should handle negative exponents', () => {
      const result = harness.evaluate(NumberTransformers.Power(-2)).withInput(2)
      expect(result).toBe(0.25)
    })

    it('should throw error for non-number values', () => {
      expect(() => harness.evaluate(NumberTransformers.Power(3)).withInput('2')).toThrow(
        'Number.Power: value failed schema validation',
      )
    })
  })

  describe('Sqrt', () => {
    it('should return square root of positive number', () => {
      const result = harness.evaluate(NumberTransformers.Sqrt()).withInput(16)
      expect(result).toBe(4)
    })

    it('should handle zero', () => {
      const result = harness.evaluate(NumberTransformers.Sqrt()).withInput(0)
      expect(result).toBe(0)
    })

    it('should handle decimals', () => {
      const result = harness.evaluate(NumberTransformers.Sqrt()).withInput(2.25)
      expect(result).toBe(1.5)
    })

    it('should throw error for negative numbers', () => {
      expect(() => harness.evaluate(NumberTransformers.Sqrt()).withInput(-4)).toThrow(
        'Cannot calculate square root of negative number in Transformer.Number.Sqrt',
      )
    })

    it('should throw error for non-number values', () => {
      expect(() => harness.evaluate(NumberTransformers.Sqrt()).withInput('16')).toThrow(
        'Number.Sqrt: value failed schema validation',
      )
    })
  })

  describe('Clamp', () => {
    it('should clamp value above maximum', () => {
      const result = harness.evaluate(NumberTransformers.Clamp(5, 10)).withInput(15)
      expect(result).toBe(10)
    })

    it('should clamp value below minimum', () => {
      const result = harness.evaluate(NumberTransformers.Clamp(5, 10)).withInput(3)
      expect(result).toBe(5)
    })

    it('should return value within range', () => {
      const result = harness.evaluate(NumberTransformers.Clamp(5, 10)).withInput(7)
      expect(result).toBe(7)
    })

    it('should handle value equal to bounds', () => {
      const result1 = harness.evaluate(NumberTransformers.Clamp(5, 10)).withInput(5)
      expect(result1).toBe(5)

      const result2 = harness.evaluate(NumberTransformers.Clamp(5, 10)).withInput(10)
      expect(result2).toBe(10)
    })

    it('should throw error for non-number values', () => {
      expect(() => harness.evaluate(NumberTransformers.Clamp(5, 10)).withInput('7')).toThrow(
        'Number.Clamp: value failed schema validation',
      )
    })
  })
})
