import { createTestEffectContext } from './createTestEffectContext'

describe('createTestEffectContext', () => {
  it('should expose empty state and defaults when no seed is provided', () => {
    // Arrange
    const context = createTestEffectContext()

    // Act
    const answers = context.getAllAnswers()
    const data = context.getAllData()

    // Assert
    expect(answers).toEqual({})
    expect(data).toEqual({})
    expect(context.getSession()).toEqual({})
    expect(context.getRequestUrl()).toBe('http://localhost/test')
    expect(context.getFieldsToClear()).toEqual([])
  })

  it('should read seeded answers through getAnswer and getAllAnswers', () => {
    // Arrange
    const context = createTestEffectContext({ answers: { name: 'Ada', age: 42 } })

    // Act
    const name = context.getAnswer('name')
    const all = context.getAllAnswers()

    // Assert
    expect(name).toBe('Ada')
    expect(all).toEqual({ name: 'Ada', age: 42 })
  })

  it('should report answer presence through hasAnswer', () => {
    // Arrange
    const context = createTestEffectContext({ answers: { name: 'Ada' } })

    // Act & Assert
    expect(context.hasAnswer('name')).toBe(true)
    expect(context.hasAnswer('missing')).toBe(false)
  })

  it('should read seeded data through getData', () => {
    // Arrange
    const context = createTestEffectContext({ data: { assessmentUuid: 'abc-123' } })

    // Act
    const value = context.getData('assessmentUuid')

    // Assert
    expect(value).toBe('abc-123')
  })

  it('should read seeded session through getSession', () => {
    // Arrange
    const context = createTestEffectContext({ session: { userId: 'user-1' } })

    // Act
    const session = context.getSession()

    // Assert
    expect(session).toEqual({ userId: 'user-1' })
  })

  it('should read seeded params through getRequestParam', () => {
    // Arrange
    const context = createTestEffectContext({ params: { id: '7' } })

    // Act
    const value = context.getRequestParam('id')

    // Assert
    expect(value).toBe('7')
  })

  it('should read seeded query through getQueryParam', () => {
    // Arrange
    const context = createTestEffectContext({ query: { tag: ['a', 'b'] } })

    // Act
    const value = context.getQueryParam('tag')

    // Assert
    expect(value).toEqual(['a', 'b'])
  })

  it('should read seeded post data through getPostData', () => {
    // Arrange
    const context = createTestEffectContext({ post: { field: 'submitted' } })

    // Act
    const value = context.getPostData('field')

    // Assert
    expect(value).toBe('submitted')
  })

  it('should read seeded state through getState', () => {
    // Arrange
    const context = createTestEffectContext({ state: { flag: true } })

    // Act
    const value = context.getState('flag')

    // Assert
    expect(value).toBe(true)
  })

  it('should read seeded headers through getRequestHeader', () => {
    // Arrange
    const context = createTestEffectContext({ headers: { 'x-trace': 'id-1' } })

    // Act
    const value = context.getRequestHeader('x-trace')

    // Assert
    expect(value).toBe('id-1')
  })

  it('should read seeded cookies through getRequestCookie', () => {
    // Arrange
    const context = createTestEffectContext({ cookies: { theme: 'dark' } })

    // Act
    const value = context.getRequestCookie('theme')

    // Assert
    expect(value).toBe('dark')
  })

  it('should return the seeded url through getRequestUrl', () => {
    // Arrange
    const context = createTestEffectContext({ url: 'https://example.com/forms/step-one?page=2' })

    // Act
    const url = context.getRequestUrl()

    // Assert
    expect(url).toBe('https://example.com/forms/step-one?page=2')
  })

  it('should record a mutation with the default access source when setting an answer', () => {
    // Arrange
    const context = createTestEffectContext()

    // Act
    context.setAnswer('name', 'Grace')

    // Assert
    expect(context.getAnswer('name')).toBe('Grace')
    expect(context.getAnswerHistory('name')?.mutations).toEqual([{ value: 'Grace', source: 'access' }])
  })

  it('should record a submit-sourced mutation when seeded with the submit hookType', () => {
    // Arrange
    const context = createTestEffectContext({ hookType: 'submit' })

    // Act
    context.setAnswer('name', 'Grace')

    // Assert
    expect(context.getAnswerHistory('name')?.mutations).toEqual([{ value: 'Grace', source: 'submit' }])
  })

  it('should capture response headers set by the effect', () => {
    // Arrange
    const context = createTestEffectContext()

    // Act
    context.setResponseHeader('x-audited', 'true')

    // Assert
    expect(context.getResponseHeaders()).toEqual({ 'x-audited': 'true' })
  })

  it('should capture response cookies including their options', () => {
    // Arrange
    const context = createTestEffectContext()

    // Act
    context.setResponseCookie('preference', 'dark', { httpOnly: true, maxAge: 1000 })

    // Assert
    expect(context.getResponseCookies()).toEqual({
      preference: { value: 'dark', options: { httpOnly: true, maxAge: 1000 } },
    })
  })

  it('should return copies of response records that do not affect later reads', () => {
    // Arrange
    const context = createTestEffectContext()
    context.setResponseHeader('x-first', 'one')

    // Act
    const headers = context.getResponseHeaders()
    headers['x-injected'] = 'mutated'

    // Assert
    expect(context.getResponseHeaders()).toEqual({ 'x-first': 'one' })
  })
})
