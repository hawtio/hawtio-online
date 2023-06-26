import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['plugins/index.ts'],
  dts: true,
  sourcemap: true
})
