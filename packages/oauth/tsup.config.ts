import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  target: 'es2015',
  dts: true,
  sourcemap: true,
  loader: {
    '.svg': 'dataurl',
    '.jpg': 'dataurl',
    '.png': 'dataurl',
    '.md': 'text',
  },
})
