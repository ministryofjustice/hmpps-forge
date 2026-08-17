import { getErrorSummaryList } from './toErrorList'

interface ErrorInput {
  message: string
  blockCode?: string
  anchor?: string
}

function callWithErrors(
  fieldErrors: ErrorInput[],
  domainErrors: ErrorInput[] = [],
): ReturnType<typeof getErrorSummaryList> {
  return getErrorSummaryList.call({
    ctx: {
      fieldValidationErrors: fieldErrors,
      domainValidationErrors: domainErrors,
    },
  })
}

describe('toErrorList', () => {
  describe('getErrorSummaryList()', () => {
    it('should link to the block code when no anchor is present', () => {
      // Arrange
      const errors = [{ message: 'Enter a name', blockCode: 'name' }]

      // Act
      const list = callWithErrors(errors)

      // Assert
      expect(list).toEqual([{ text: 'Enter a name', href: '#name' }])
    })

    it('should prefer the anchor over the block code when both are present', () => {
      // Arrange
      const errors = [{ message: 'Select an answer', blockCode: 'employed', anchor: 'employed-unavailable' }]

      // Act
      const list = callWithErrors(errors)

      // Assert
      expect(list).toEqual([{ text: 'Select an answer', href: '#employed-unavailable' }])
    })

    it('should keep same-code errors separate when their anchors differ', () => {
      // Arrange
      const errors = [
        { message: 'Select an answer', blockCode: 'employed', anchor: 'employed-a' },
        { message: 'Select an answer', blockCode: 'employed', anchor: 'employed-b' },
      ]

      // Act
      const list = callWithErrors(errors)

      // Assert
      expect(list).toEqual([
        { text: 'Select an answer', href: '#employed-a' },
        { text: 'Select an answer', href: '#employed-b' },
      ])
    })

    it('should deduplicate errors sharing an anchor', () => {
      // Arrange
      const errors = [
        { message: 'Select an answer', blockCode: 'employed', anchor: 'employed-a' },
        { message: 'Answer is too vague', blockCode: 'employed', anchor: 'employed-a' },
      ]

      // Act
      const list = callWithErrors(errors)

      // Assert
      expect(list).toEqual([{ text: 'Select an answer', href: '#employed-a' }])
    })

    it('should omit the href and deduplicate by message when neither anchor nor block code is present', () => {
      // Arrange
      const errors = [{ message: 'Something went wrong' }, { message: 'Something went wrong' }]

      // Act
      const list = callWithErrors(errors)

      // Assert
      expect(list).toEqual([{ text: 'Something went wrong', href: undefined }])
    })

    it('should list domain errors before field errors', () => {
      // Arrange
      const fieldErrors = [{ message: 'Enter a name', blockCode: 'name' }]
      const domainErrors = [{ message: 'Check the whole form' }]

      // Act
      const list = callWithErrors(fieldErrors, domainErrors)

      // Assert
      expect(list).toEqual([
        { text: 'Check the whole form', href: undefined },
        { text: 'Enter a name', href: '#name' },
      ])
    })
  })
})
