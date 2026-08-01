import hmppsConfig from '@ministryofjustice/eslint-config-hmpps'
import forgeCore from './forge-core/eslint.config.mjs'
import forgeExpressNunjucks from './forge-express-nunjucks/eslint.config.mjs'
import forgeGovukComponents from './forge-govuk-components/eslint.config.mjs'
import forgeMojComponents from './forge-moj-components/eslint.config.mjs'
import forgeJsxComponents from './forge-jsx-components/eslint.config.mjs'
import forgeDevtools from './forge-devtools/eslint.config.mjs'

const forgePackages = [
  { dir: 'forge-core', subpath: 'core' },
  { dir: 'forge-express-nunjucks', subpath: 'express-nunjucks' },
  { dir: 'forge-govuk-components', subpath: 'govuk-components' },
  { dir: 'forge-moj-components', subpath: 'moj-components' },
  { dir: 'forge-jsx-components', subpath: 'jsx-components' },
  { dir: 'forge-devtools', subpath: 'devtools' },
]

// Each package must not import its own published subpath, nor reach into a
// sibling package's src/ — siblings are consumed via their public subpaths.
const crossImportBans = forgePackages.map(({ dir, subpath }) => ({
  files: [`${dir}/**/*.ts`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          `@ministryofjustice/hmpps-forge/${subpath}`,
          `@ministryofjustice/hmpps-forge/${subpath}/*`,
          ...forgePackages
            .filter(sibling => sibling.dir !== dir)
            .flatMap(sibling => [`**/${sibling.dir}/src`, `**/${sibling.dir}/src/**`]),
        ],
      },
    ],
  },
}))

export default [
  { ignores: ['**/dist/**'] },
  ...hmppsConfig({
    extraIgnorePaths: ['dist/', '*.config.*'],
  }),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-param-reassign': 'off',
      'prefer-destructuring': 'off',
      'import/prefer-default-export': 'off',
      'import/no-cycle': 'off',
      'no-plusplus': 'off',
      'no-await-in-loop': 'off',
      'no-continue': 'off',
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
  },
  {
    files: ['**/test-utils/**/*.ts', '**/test-utils/**/*.js', '**/testing-helpers/**/*.ts'],
    rules: {
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },
  {
    // The rolldown build configs are build-time tooling and import devDependencies (sass, rolldown-plugin-dts)
    files: ['rolldown.*.mjs', '**/rolldown.config.mjs'],
    rules: {
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },
  ...crossImportBans,
  ...forgeCore,
  ...forgeExpressNunjucks,
  ...forgeGovukComponents,
  ...forgeMojComponents,
  ...forgeJsxComponents,
  ...forgeDevtools,
  {
    name: 'prettier-overrides',
    rules: {
      'prettier/prettier': [
        'warn',
        {
          trailingComma: 'all',
          singleQuote: true,
          printWidth: 120,
          semi: false,
          arrowParens: 'avoid',
          alignObjectProperties: 'none',
          returnParentheses: false,
          plugins: ['@yikes2000/prettier-plugin-merge-extras'],
        },
      ],
    },
  },
]
