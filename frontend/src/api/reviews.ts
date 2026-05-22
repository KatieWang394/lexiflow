/**
 * Reviews API
 * ===========
 * 对应后端路由 /reviews/today 和 /terms/:id/reviews (routers/reviews.py)。
 *
 * 规则：只有 src/api/ 下的文件才能 import axios/apiClient。
 */

import type { ReviewCreate, ReviewLog, TodayReviewsResponse } from '@/types/api'
import apiClient from './client'

/**
 * GET /reviews/today
 * 获取今日复习队列：到期的旧词 + 限量的新词。
 *
 * @param newLimit 新词上限，默认 10，范围 [0, 50]
 */
export async function getTodayReviews(
  newLimit?: number,
): Promise<TodayReviewsResponse> {
  const response = await apiClient.get<TodayReviewsResponse>('/reviews/today', {
    params: newLimit !== undefined ? { new_limit: newLimit } : undefined,
  })
  return response.data
}

/**
 * POST /terms/:termId/reviews
 * 提交复习评分。后端会更新词条的 SRS 状态并写入复习日志。
 *
 * @param termId 词条 ID
 * @param data   { rating: ReviewRating }
 */
export async function submitReview(
  termId: number,
  data: ReviewCreate,
): Promise<ReviewLog> {
  const response = await apiClient.post<ReviewLog>(
    `/terms/${termId}/reviews`,
    data,
  )
  return response.data
}

/**
 * GET /terms/:termId/reviews
 * 获取某个词条的全部复习历史记录，按时间倒序排列。
 */
export async function getTermReviews(termId: number): Promise<ReviewLog[]> {
  const response = await apiClient.get<ReviewLog[]>(`/terms/${termId}/reviews`)
  return response.data
}
