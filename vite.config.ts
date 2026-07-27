import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // `npm run dev` (hot reload op :5173) stuurt API-calls door naar de
    // draaiende wrangler/docker-omgeving op :8788.
    proxy: {
      '/api': 'http://localhost:8788',
    },
  },
})
