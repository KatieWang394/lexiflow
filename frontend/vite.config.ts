import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),   // Tailwind v4 用 Vite 插件，不再需要 postcss 配置
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),  // shadcn/ui 需要的 @/ 别名
    },
  },
})
