import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    assetsInlineLimit: 8192,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0])
