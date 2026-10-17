import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) })

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // server.ts, src/ and vite.config.ts are a gitignored legacy Vite app (also excluded in tsconfig.json)
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'coverage/**', 'screenshots/**', 'server.ts', 'src/**', 'vite.config.ts', '.remember/**'],
  },
]

export default eslintConfig
