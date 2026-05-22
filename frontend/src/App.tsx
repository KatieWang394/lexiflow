/**
 * App — 路由配置 + 全局 Provider
 * ================================
 * 结构：
 *   QueryClientProvider          ← TanStack Query 全局 cache
 *     BrowserRouter
 *       Routes
 *         Route element=AppLayout  ← 共享布局（header + bottom nav）
 *           Route /                → HomePage
 *           Route /terms           → TermListPage
 *           Route /terms/new       → AddTermPage   ← 必须在 :id 前面
 *           Route /terms/:id       → TermDetailPage
 *           Route /terms/:id/edit  → EditTermPage
 *           Route /review          → ReviewPage
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import AppLayout from '@/components/AppLayout'
import HomePage from '@/pages/HomePage'
import TermListPage from '@/pages/TermListPage'
import AddTermPage from '@/pages/AddTermPage'
import TermDetailPage from '@/pages/TermDetailPage'
import EditTermPage from '@/pages/EditTermPage'
import ReviewPage from '@/pages/ReviewPage'

// 全局 QueryClient 实例
// staleTime: 30s — 列表数据短暂缓存，避免切 tab 时立即重请求
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* AppLayout 作为所有页面的外壳（header + bottom nav） */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/terms" element={<TermListPage />} />
            {/* /terms/new 必须在 /terms/:id 前面，否则 "new" 会被当成 id */}
            <Route path="/terms/new" element={<AddTermPage />} />
            <Route path="/terms/:id" element={<TermDetailPage />} />
            <Route path="/terms/:id/edit" element={<EditTermPage />} />
            <Route path="/review" element={<ReviewPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
