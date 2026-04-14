import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8080'
/** WebSocket wiki-page (cmd/wiki_page): /api/v1/ws — отдельный порт от table-сервиса */
const wikiPageTarget = process.env.VITE_WIKI_PAGE_PROXY_TARGET || 'http://127.0.0.1:8081'

const devProxy = {
  '/api/v1/ws': {
    target: wikiPageTarget,
    changeOrigin: true,
    ws: true,
  },
  '/api': {
    target: apiTarget,
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: devProxy,
  },
  /** `vite preview` (порт 4173) по умолчанию не проксирует /api — без этого запросы не доходят до бэкенда */
  preview: {
    proxy: devProxy,
  },
})
