export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx)', '**/?(*.)+(spec|test).+(ts|tsx)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@ministryofjustice/hmpps-forge/core$': '<rootDir>/form-engine/src/index.ts',
    '^@ministryofjustice/hmpps-forge/core/authoring$': '<rootDir>/form-engine/src/authoring/index.ts',
    '^@ministryofjustice/hmpps-forge/core/components$': '<rootDir>/form-engine/src/components/index.ts',
    '^@ministryofjustice/hmpps-forge/core/framework$': '<rootDir>/form-engine/src/framework/index.ts',
    '^@ministryofjustice/hmpps-forge/express-nunjucks$': '<rootDir>/form-engine-express-nunjucks/src/index.ts',
    '^@ministryofjustice/hmpps-forge/govuk-components$': '<rootDir>/form-engine-govuk-components/src/index.ts',
    '^@ministryofjustice/hmpps-forge/moj-components$': '<rootDir>/form-engine-moj-components/src/index.ts',
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
