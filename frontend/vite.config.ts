import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/providers': 'http://localhost:8099',
      '/generate': 'http://localhost:8099',
      '/generate-one': 'http://localhost:8099',
      '/slots': 'http://localhost:8099',
      '/prompts': 'http://localhost:8099',
      '/dimensions': 'http://localhost:8099',
      '/choices': 'http://localhost:8099',
      '/product-knowledge': 'http://localhost:8099',
      '/extra-inputs': 'http://localhost:8099',
      '/re-review': 'http://localhost:8099',
      '/finalized': 'http://localhost:8099',
      '/health': 'http://localhost:8099',
    },
  },
})
