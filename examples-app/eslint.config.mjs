import hmppsConfig from '@ministryofjustice/eslint-config-hmpps'

export default [
  ...hmppsConfig(),
  {
    rules: {
      'import/prefer-default-export': 'off',
      'import/no-named-as-default': 'off',
    },
  },
]
