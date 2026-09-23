import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'functions/lib']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      // Context/hook files and shadcn primitives export helpers next to components by design.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Adapters for untyped Firestore documents; tighten these types over time.
    files: ['src/services/firestore/**', 'src/utils/{dataValidation,safeData,calendarDataIngestion,verifyCalendarData,devSeeding}.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'warn' },
  },
])
