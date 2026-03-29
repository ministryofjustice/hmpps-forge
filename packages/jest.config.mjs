export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    '^hmpps-forge/core$': '<rootDir>/form-engine/src/index.ts',
    '^hmpps-forge/core/authoring$': '<rootDir>/form-engine/src/authoring/index.ts',
    '^hmpps-forge/core/components$': '<rootDir>/form-engine/src/components/index.ts',
    '^hmpps-forge/core/framework$': '<rootDir>/form-engine/src/framework/index.ts',
    '^hmpps-forge/core/testing$': '<rootDir>/form-engine/src/testing/index.ts',
    '^hmpps-forge/express-nunjucks$': '<rootDir>/form-engine-express-nunjucks/src/index.ts',
    '^hmpps-forge/govuk-components$': '<rootDir>/form-engine-govuk-components/src/index.ts',
    '^hmpps-forge/moj-components$': '<rootDir>/form-engine-moj-components/src/index.ts',
  },
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  coveragePathIgnorePatterns: ['.*\\/test\\/.*', '.*\\/test-utils\\/.*'],
}
