/**
 * useReviews — TanStack Query hooks for /reviews API
 * ====================================================
 * 规则：只有 src/api/ 可以调用 axios。
 * 这里通过 src/api/reviews.ts 的函数访问后端。
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTodayReviews, submitReview, getTermReviews } from '@/api/reviews'
import { termKeys } from '@/hooks/useTerms'
import type { ReviewRating } from '@/types/api'

// ---- Query key 常量 ---------------------------------------------------

export const reviewKeys = {
  /** 今日复习队列 */
  today: () => ['reviews', 'today'] as const,
  /** 单个词条的复习历史 */
  termHistory: (termId: number) => ['reviews', 'term', termId] as const,
} as const

// ---- Queries ---------------------------------------------------------

/**
 * useTodayReviews
 * 封装 GET /reviews/today。
 * 返回 { due_reviews, new_terms }，两个列表分开。
 *
 * @param newLimit 新词上限（默认 10）
 */
export function useTodayReviews(newLimit?: number) {
  return useQuery({
    queryKey: reviewKeys.today(),
    queryFn: () => getTodayReviews(newLimit),
  })
}

/** useTermReviews — GET /terms/:termId/reviews，按时间倒序返回 */
export function useTermReviews(termId: number) {
  return useQuery({
    queryKey: reviewKeys.termHistory(termId),
    queryFn: () => getTermReviews(termId),
  })
}

// ---- Mutations -------------------------------------------------------

/**
 * useSubmitReview
 * 封装 POST /terms/:termId/reviews。
 * 成功后 invalidate 今日复习队列 + 词条列表，
 * 确保其他页面（首页、词条列表）看到最新数据。
 */
export function useSubmitReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      termId,
      rating,
    }: {
      termId: number
      rating: ReviewRating
    }) => submitReview(termId, { rating }),

    onSuccess: () => {
      // 使今日复习队列和词条列表缓存过期，下次访问时重新拉取
      queryClient.invalidateQueries({ queryKey: reviewKeys.today() })
      queryClient.invalidateQueries({ queryKey: termKeys.lists() })
    },
  })
}
