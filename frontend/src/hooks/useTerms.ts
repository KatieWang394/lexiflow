/**
 * useTerms — TanStack Query hooks for /terms API
 * ================================================
 * 规则：只有 src/api/ 可以直接调用 axios。
 * 这里通过 src/api/terms.ts 的函数访问后端，不直接 import apiClient。
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTerms, getTerm, createTerm, updateTerm, deleteTerm } from '@/api/terms'
import type { TermCreate, TermUpdate, TermsQueryParams } from '@/types/api'

// ---- Query key 常量（统一管理，方便后续页面共享 invalidate） ----

export const termKeys = {
  /** 词条列表（含过滤参数） */
  lists: () => ['terms'] as const,
  /** 带具体参数的列表（用于精确 cache） */
  list: (params: TermsQueryParams) => ['terms', 'list', params] as const,
  /** 单个词条详情 */
  detail: (id: number) => ['terms', id] as const,
} as const

// ---- Queries ---------------------------------------------------------

/**
 * useTerms
 * 封装 GET /terms，支持 skip / limit / status / tag 过滤。
 * 每组参数组合对应独立的缓存 key。
 */
export function useTerms(params: TermsQueryParams = {}) {
  return useQuery({
    queryKey: termKeys.list(params),
    queryFn: () => getTerms(params),
  })
}

// ---- Mutations -------------------------------------------------------

/** useCreateTerm — POST /terms */
export function useCreateTerm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: TermCreate) => createTerm(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: termKeys.lists() })
    },
  })
}

/** useUpdateTerm — PUT /terms/:id，只发送变更字段 */
export function useUpdateTerm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TermUpdate }) =>
      updateTerm(id, data),
    onSuccess: (updatedTerm) => {
      // 直接更新详情缓存，避免额外请求
      queryClient.setQueryData(termKeys.detail(updatedTerm.id), updatedTerm)
      queryClient.invalidateQueries({ queryKey: termKeys.lists() })
    },
  })
}

/** useDeleteTerm — DELETE /terms/:id */
export function useDeleteTerm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteTerm(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: termKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: termKeys.lists() })
    },
  })
}

/** useTerm — GET /terms/:id */
export function useTerm(id: number) {
  return useQuery({
    queryKey: termKeys.detail(id),
    queryFn: () => getTerm(id),
  })
}
