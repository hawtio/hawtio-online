import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteTsconfigPaths from 'vite-tsconfig-paths'
import { createHtmlPlugin } from 'vite-plugin-html'
import path from 'path'

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
      rollupOptions: {
        input: {
          app: './index.html', // default
        },
      },
    },
    plugins: [
      react({
        // Use React plugin in all *.jsx and *.tsx files
        include: '**/*.{jsx,tsx}',
      }),
      viteTsconfigPaths()
    ],
    publicDir: 'public',
    resolve: {
      alias: {
        src: path.resolve(__dirname, 'src'),
      }
    }
  }
})
