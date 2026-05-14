// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      // Vue — TypeScript đã handle default values, không cần rule này
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/no-multiple-template-root': 'off',
      'vue/html-self-closing': ['warn', {
        html: { void: 'never', normal: 'always', component: 'always' },
      }],

      // TypeScript
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/unified-signatures': 'warn',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  }
)
