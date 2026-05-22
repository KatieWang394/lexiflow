/**
 * Terms API
 * =========
 * 对应后端路由 /terms (routers/terms.py)。
 *
 * 规则：只有 src/api/ 下的文件才能 import axios/apiClient。
 * Pages 和 components 通过 hooks/ 里的 TanStack Query 钩子访问数据。
 */

import type { Term, TermCreate, TermUpdate, TermsQueryParams } from '@/types/api'
import apiClient from './client'

/**
 * GET /terms
 * 获取词条列表，支持分页、状态过滤和标签过滤。
 */
export async function getTerms(params?: TermsQueryParams): Promise<Term[]> {
  const response = await apiClient.get<Term[]>('/terms', { params })
  return response.data
}

/**
 * GET /terms/:id
 * 获取单个词条，不存在时后端返回 404。
 */
export async function getTerm(id: number): Promise<Term> {
  const response = await apiClient.get<Term>(`/terms/${id}`)
  return response.data
}

/**
 * POST /terms
 * 创建词条。只有 term 字段是必填的。
 */
export async function createTerm(data: TermCreate): Promise<Term> {
  const response = await apiClient.post<Term>('/terms', data)
  return response.data
}

/**
 * PUT /terms/:id
 * 局部更新词条。未传的字段保持不变；tags: [] 会清空标签。
 */
export async function updateTerm(id: number, data: TermUpdate): Promise<Term> {
  const response = await apiClient.put<Term>(`/terms/${id}`, data)
  return response.data
}

/**
 * DELETE /terms/:id
 * 删除词条及其所有复习记录（级联删除）。
 * 后端返回 { "detail": "Term deleted" }。
 */
export async function deleteTerm(id: number): Promise<{ detail: string }> {
  const response = await apiClient.delete<{ detail: string }>(`/terms/${id}`)
  return response.data
}
