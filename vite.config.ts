import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

const disableDevtools = process.env.DISABLE_TANSTACK_DEVTOOLS === '1'

const config = defineConfig({
  plugins: [
    !disableDevtools ? devtools() : null,
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tanstackStart(),
    viteReact(),
  ].filter(Boolean),
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    exclude: ['src/tests/e2e/**', 'node_modules/**'],
  },
})

export default config
