/**
 * useTerms — TanStack Query hooks for /terms API
 * ================================================
 * 规则：只有 src/api/ 可以直接调用 axios。
 * 这里通过 src/api/terms.ts 的函数访问后端，不直接 import apiClient。
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTerm } from '@/api/terms'
import type { TermCreate } from '@/types/api'

// ---- Query key 常量（统一管理，方便后续页面共享 invalidate） ----

export const termKeys = {
  /** 词条列表（含过滤参数） */
  lists: () => ['terms'] as const,
  /** 单个词条详情 */
  detail: (id: number) => ['terms', id] as const,
} as const

// ---- Mutations -------------------------------------------------------

/**
 * useCreateTerm
 * 封装 POST /terms 请求。
 * 提交成功后自动 invalidate 词条列表缓存，确保列表页看到最新数据。
 */
export function useCreateTerm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: TermCreate) => createTerm(data),

    onSuccess: () => {
      // 让 TermListPage 下次显示时重新获取最新列表
      queryClient.invalidateQueries({ queryKey: termKeys.lists() })
    },
  })
}
