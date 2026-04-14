import hmppsConfig from '@ministryofjustice/eslint-config-hmpps'

export default [
  {
    ignores: ['rolldown/**', 'assets/**'],
  },
  ...hmppsConfig(),
  {
    rules: {
      'import/prefer-default-export': 'off',
      'import/no-named-as-default': 'off',
      'prettier/prettier': [
        'warn',
        {
          trailingComma: 'all',
          singleQuote: true,
          printWidth: 100,
          semi: false,
          arrowParens: 'avoid',
        },
      ],
    },
  },
]
