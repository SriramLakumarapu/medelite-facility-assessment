import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/cms': {
        target: 'https://data.cms.gov/provider-data/api/1/datastore/query',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cms/, ''),
      },
    },
  },
})
