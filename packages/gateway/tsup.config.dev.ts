import { defineConfig } from 'tsup'

export default defineConfig({
  name: 'gateway-api',
  entry: ['src/gateway-api.ts'],
  outDir: 'dist',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  loader: {
    '.yaml': 'text',
  },
  platform: 'node',
  onSuccess: 'node --env-file .env.development dist/gateway-api.js',
  publicDir: 'public',
  watch: true,
})
