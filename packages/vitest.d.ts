/// <reference types="vitest/globals" />
import type { Mock as VitestMock, Mocked as VitestMocked, MockedClass as VitestMockedClass } from 'vitest'

type AnyFunction = (...args: any[]) => any

type AnyConstructor = new (...args: any[]) => any

declare global {
  type Mock<T extends AnyFunction = AnyFunction> = VitestMock<T>
  type Mocked<T> = VitestMocked<T>
  type MockedClass<T extends AnyConstructor> = VitestMockedClass<T>
}

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toContainText(expected: string): T
    toHaveNodeCount(expected: number): T
    toHaveDepth(expected: number): T
    toContainNodeWithId(expectedId: number): T
    toHaveNodeType(expectedType: string): T
    toHaveValidStructure(): T
  }

  interface AsymmetricMatchersContaining {
    toContainText(expected: string): void
    toHaveNodeCount(expected: number): void
    toHaveDepth(expected: number): void
    toContainNodeWithId(expectedId: number): void
    toHaveNodeType(expectedType: string): void
    toHaveValidStructure(): void
  }
}

export {}
