export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx)', '**/?(*.)+(spec|test).+(ts|tsx)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@ministryofjustice/hmpps-forge/core$': '<rootDir>/forge-core/src/index.ts',
    '^@ministryofjustice/hmpps-forge/core/authoring$': '<rootDir>/forge-core/src/authoring/index.ts',
    '^@ministryofjustice/hmpps-forge/core/components$': '<rootDir>/forge-core/src/components/index.ts',
    '^@ministryofjustice/hmpps-forge/core/framework$': '<rootDir>/forge-core/src/framework/index.ts',
    '^@ministryofjustice/hmpps-forge/express-nunjucks$': '<rootDir>/forge-express-nunjucks/src/index.ts',
    '^@ministryofjustice/hmpps-forge/govuk-components$': '<rootDir>/forge-govuk-components/src/index.ts',
    '^@ministryofjustice/hmpps-forge/moj-components$': '<rootDir>/forge-moj-components/src/index.ts',
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
