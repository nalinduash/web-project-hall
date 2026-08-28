import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const certPath = path.resolve(__dirname, '../backend/.certs/cert.pem')
  const keyPath = path.resolve(__dirname, '../backend/.certs/key.pem')
  
  // Enable HTTPS if VITE_HTTPS is true or if backend certs exist (unless explicitly disabled with VITE_HTTPS=false)
  const isHttpsDisabled = env.VITE_HTTPS === 'false' || process.env.VITE_HTTPS === 'false'
  const certsExist = fs.existsSync(certPath) && fs.existsSync(keyPath)
  const isHttps = !isHttpsDisabled && (env.VITE_HTTPS === 'true' || process.env.VITE_HTTPS === 'true' || certsExist)

  const httpsConfig = isHttps && certsExist
    ? {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    : false

  return {
    plugins: [react(), tailwindcss()],
    server: {
      https: httpsConfig,
      allowedHosts: [
        "4.240.112.63.nip.io",
        "localhost"
      ],
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    optimizeDeps: {
      exclude: ['@phosphor-icons/react']
    }
  }
})

