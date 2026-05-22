/**
 * API 类型定义
 * ============
 * 所有类型都与后端 schemas.py 一一对齐。
 * 修改后端 schema 时，必须同步更新这里。
 *
 * 命名映射：
 *   TermResponse       → Term
 *   ReviewLogResponse  → ReviewLog
 *   其余命名保持一致
 */

// ============================================================
// 共用约束类型
// ============================================================

/** 对应 backend TermStatus = Literal["new", "learning", "mastered"] */
export type TermStatus = 'new' | 'learning' | 'mastered'

/** 对应 backend ReviewRating = Literal["forgot", "hard", "good", "easy"] */
export type ReviewRating = 'forgot' | 'hard' | 'good' | 'easy'

/**
 * 前端复习模式（后端无对应字段）。
 * v0.1 只实现 "flashcard"，"typing" 留作未来扩展。
 */
export type ReviewMode = 'flashcard' | 'typing'

// ============================================================
// Term 相关类型
// ============================================================

/**
 * 对应 backend TermResponse。
 * 后端 datetime 字段序列化为 ISO 8601 字符串，前端用 string 接收，
 * 显示时再转换为本地时间。
 */
export interface Term {
  id: number
  term: string
  language: string
  definition: string
  examples: string
  usage_context: string
  tags: string[]           // 后端把逗号字符串转换成 list[str] 再返回
  status: TermStatus
  ease_factor: number
  interval_days: number
  repetitions: number
  created_at: string       // ISO 8601 UTC
  updated_at: string       // ISO 8601 UTC
  last_reviewed_at: string | null
  next_review_at: string | null
}

/**
 * 对应 backend TermCreate。
 * 只有 term 是必填字段，其余都有默认值。
 */
export interface TermCreate {
  term: string
  language?: string        // 默认 "en"
  definition?: string      // 默认 ""
  examples?: string        // 默认 ""
  usage_context?: string   // 默认 ""
  tags?: string[]          // 默认 []
}

/**
 * 对应 backend TermUpdate。
 * 所有字段均为 optional：
 *   - 字段缺失（undefined）→ 后端保持原值
 *   - tags: undefined       → 保持原 tags
 *   - tags: []              → 清空 tags
 */
export interface TermUpdate {
  term?: string
  language?: string
  definition?: string
  examples?: string
  usage_context?: string
  tags?: string[]          // undefined = 不更新；[] = 清空
}

// ============================================================
// Review 相关类型
// ============================================================

/** 对应 backend ReviewCreate */
export interface ReviewCreate {
  rating: ReviewRating
}

/** 对应 backend ReviewLogResponse */
export interface ReviewLog {
  id: number
  term_id: number
  rating: ReviewRating
  reviewed_at: string                    // ISO 8601 UTC
  previous_next_review_at: string | null
  new_next_review_at: string             // ISO 8601 UTC
  interval_days_after: number
}

/**
 * 对应 backend TodayReviewsResponse。
 * due_reviews 和 new_terms 不会重叠：
 *   - due_reviews: status != "new" 且 next_review_at <= now
 *   - new_terms:   status == "new"，按 created_at 升序，受 new_limit 限制
 */
export interface TodayReviewsResponse {
  due_reviews: Term[]
  new_terms: Term[]
}

// ============================================================
// GET /terms 查询参数
// ============================================================

/** GET /terms 的可选查询参数 */
export interface TermsQueryParams {
  skip?: number      // 默认 0
  limit?: number     // 默认 50，范围 [1, 100]
  status?: TermStatus
  tag?: string
}
