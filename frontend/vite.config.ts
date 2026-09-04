import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // la app se publica en ladyslavanderia.cl/app: sin esto el build queda en blanco
  base: '/app/',
  plugins: [react()],
  server: { port: 3000, host: true },
  preview: { port: 3000, host: true },
})
