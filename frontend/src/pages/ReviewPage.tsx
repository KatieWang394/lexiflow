/**
 * ReviewPage — 今日复习（闪卡模式）
 * ====================================
 * 流程（参考 FRONTEND_DECISIONS.md F09、F13）：
 *
 *   页面加载 → GET /reviews/today → 构建本地 queue（不随 cache 刷新变化）
 *   Phase: 'init'      — 数据还未到达，显示加载中
 *   Phase: 'reviewing' — 显示当前卡片
 *     正面 → 点击 "Show Answer" → 背面
 *     背面 → 点击评分 → POST /terms/:id/reviews
 *            → 成功：进入下一张
 *   Phase: 'divider'   — due_reviews 结束，new_terms 即将开始
 *   Phase: 'done'      — 所有卡片完成
 *   Phase: 'empty'     — 今日无复习任务
 *
 * 状态管理：useState（F13 决策：逻辑简单，不需要 useReducer）
 * 不在前端重新计算调度值（F10 决策）
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, RefreshCw, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTodayReviews, useSubmitReview } from '@/hooks/useReviews'
import type { Term, ReviewRating } from '@/types/api'

// ---- 类型 & 常量 -------------------------------------------------------

type Phase = 'init' | 'reviewing' | 'divider' | 'done' | 'empty'

/**
 * 4 个评分按钮的展示配置。
 * 颜色用 Tailwind 语义色（不依赖 CSS 变量）直接区分。
 * 标签含中英文双语，适配多语言用户。
 */
const RATING_CONFIG = [
  {
    rating: 'forgot' as const,
    zh: '忘了',
    en: 'Forgot',
    className:
      'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200',
  },
  {
    rating: 'hard' as const,
    zh: '难',
    en: 'Hard',
    className:
      'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 active:bg-amber-200',
  },
  {
    rating: 'good' as const,
    zh: '记得',
    en: 'Good',
    className:
      'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200',
  },
  {
    rating: 'easy' as const,
    zh: '简单',
    en: 'Easy',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200',
  },
] as const

// ---- 主组件 ------------------------------------------------------------

export default function ReviewPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useTodayReviews()
  const { mutateAsync } = useSubmitReview()

  // ── 本地 session 状态（只初始化一次，不随 cache 刷新重置）──
  const initialized = useRef(false)
  const [queue, setQueue] = useState<Term[]>([])
  const [dueCount, setDueCount] = useState(0)     // due_reviews 的数量
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false)
  const [phase, setPhase] = useState<Phase>('init')
  const [submittingRating, setSubmittingRating] = useState<ReviewRating | null>(null)
  const [submitError, setSubmitError] = useState(false)

  // ── 初始化 queue（只跑一次，之后即使 cache 刷新也不重置）──
  useEffect(() => {
    if (!data || initialized.current) return
    initialized.current = true

    const combined = [...data.due_reviews, ...data.new_terms]
    setQueue(combined)
    setDueCount(data.due_reviews.length)
    setPhase(combined.length === 0 ? 'empty' : 'reviewing')
  }, [data])

  // ── 提交评分 ──────────────────────────────────────────────
  async function handleRating(rating: ReviewRating) {
    const currentTerm = queue[currentIndex]
    setSubmitError(false)
    setSubmittingRating(rating)

    try {
      await mutateAsync({ termId: currentTerm.id, rating })

      const nextIndex = currentIndex + 1

      if (nextIndex >= queue.length) {
        // 所有卡片完成
        setPhase('done')
      } else if (
        currentIndex === dueCount - 1 &&
        dueCount > 0 &&
        queue.length > dueCount
      ) {
        // 刚完成最后一张复习卡，接下来是新词
        setPhase('divider')
      } else {
        setCurrentIndex(nextIndex)
        setIsRevealed(false)
      }
    } catch {
      // 提交失败：停在当前卡片，显示错误提示
      setSubmitError(true)
    } finally {
      setSubmittingRating(null)
    }
  }

  function handleContinueFromDivider() {
    setPhase('reviewing')
    setCurrentIndex(dueCount) // 从第一个新词开始
    setIsRevealed(false)
  }

  // ================================================================
  // 渲染分支
  // ================================================================

  // ── 加载中 ────────────────────────────────────────────────
  if (isLoading || phase === 'init') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <p className="text-sm">加载今日任务…</p>
      </div>
    )
  }

  // ── 请求失败 ───────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          加载失败，请检查后端是否在运行。
        </p>
        <Button
          variant="outline"
          onClick={() => {
            initialized.current = false
            refetch()
          }}
          className="gap-1.5"
        >
          <RefreshCw className="size-4" />
          重试
        </Button>
      </div>
    )
  }

  // ── 今日无任务 ─────────────────────────────────────────────
  if (phase === 'empty') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-5 p-8 text-center">
        <div className="size-16 rounded-full bg-muted flex items-center justify-center">
          <CheckCircle2 className="size-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1">今日已全部完成</h2>
          <p className="text-sm text-muted-foreground">
            没有待复习的词条，也没有新词。
            <br />
            明天继续保持！
          </p>
        </div>
        <Button
          onClick={() => navigate('/terms/new')}
          className="gap-1.5 mt-1"
        >
          <Plus className="size-4" />
          添加新词条
        </Button>
      </div>
    )
  }

  // ── 分界过渡页（due_reviews → new_terms）──────────────────
  if (phase === 'divider') {
    const newCount = queue.length - dueCount
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-6 p-8 text-center">
        <div className="size-16 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="size-8 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1">
            复习完成 {dueCount} 张 ✓
          </h2>
          <p className="text-sm text-muted-foreground">
            接下来是今日新词
          </p>
        </div>

        {/* 分界线 */}
        <div className="flex items-center gap-3 w-full max-w-xs">
          <div className="flex-1 h-px bg-border" />
          <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
            <Sparkles className="size-3" />
            今日新词 · {newCount} 个
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <Button
          onClick={handleContinueFromDivider}
          className="w-full max-w-xs"
        >
          开始学习新词
        </Button>
      </div>
    )
  }

  // ── 全部完成 ───────────────────────────────────────────────
  if (phase === 'done') {
    const reviewedDue = dueCount
    const reviewedNew = queue.length - dueCount
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-6 p-8 text-center">
        <div className="size-20 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="size-10 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">今日完成！🎉</h2>
          <p className="text-sm text-muted-foreground">
            {reviewedDue > 0 && `复习 ${reviewedDue} 张`}
            {reviewedDue > 0 && reviewedNew > 0 && ' · '}
            {reviewedNew > 0 && `新词 ${reviewedNew} 个`}
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button onClick={() => navigate('/terms')}>查看词条列表</Button>
          <Button variant="outline" onClick={() => navigate('/')}>
            回到首页
          </Button>
        </div>
      </div>
    )
  }

  // ================================================================
  // Phase: 'reviewing' — 主要闪卡界面
  // ================================================================

  const currentTerm = queue[currentIndex]
  const isNewTerm = currentIndex >= dueCount
  // 进度百分比：当前卡片在 queue 中的位置（完成 currentIndex 张）
  const progressPct = queue.length > 0
    ? Math.round((currentIndex / queue.length) * 100)
    : 0

  return (
    <div className="flex flex-col flex-1">

      {/* ── 顶部进度区域 ──────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">
            {isNewTerm ? (
              <span className="inline-flex items-center gap-1">
                <Sparkles className="size-3" />
                新词
              </span>
            ) : (
              '复习'
            )}
          </span>
          <span className="text-xs font-medium tabular-nums text-foreground/70">
            {currentIndex + 1} / {queue.length}
          </span>
        </div>
        {/* 进度条 */}
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground/25 transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* ── 卡片区域 ─────────────────────────────────────── */}
      <div className="flex-1 px-4 pb-6">
        {!isRevealed ? (
          // ────────────────── 正面 ──────────────────
          <div className="flex flex-col min-h-[62vh] rounded-2xl border border-border bg-card p-6 shadow-sm">

            {/* 新词标签（右上角） */}
            <div className="flex justify-end min-h-[22px]">
              {isNewTerm && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  <Sparkles className="size-3" />
                  新词
                </span>
              )}
            </div>

            {/* 词条——竖向居中 */}
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <p className="text-[2rem] font-bold leading-snug break-words w-full mb-3">
                {currentTerm.term}
              </p>
              <p className="text-sm text-muted-foreground">
                {currentTerm.language}
                {currentTerm.tags.length > 0 && (
                  <span> · {currentTerm.tags.join(' · ')}</span>
                )}
              </p>
            </div>

            {/* Show Answer 按钮 */}
            <Button
              onClick={() => setIsRevealed(true)}
              className="w-full h-12 text-[0.9375rem]"
            >
              Show Answer
            </Button>
          </div>
        ) : (
          // ────────────────── 背面 ──────────────────
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">

            {/* 词条 header（紧凑版） */}
            <div className="px-6 pt-5 pb-4 border-b border-border/60">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xl font-semibold leading-snug break-words flex-1">
                  {currentTerm.term}
                </p>
                {isNewTerm && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    <Sparkles className="size-3" />
                    新词
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {currentTerm.language}
                {currentTerm.tags.length > 0 && (
                  <span> · {currentTerm.tags.join(' · ')}</span>
                )}
              </p>
            </div>

            {/* 内容区 */}
            <div className="px-6 py-5 flex flex-col gap-5">
              {/* 三个内容字段都为空时的提示 */}
              {!currentTerm.definition &&
                !currentTerm.examples &&
                !currentTerm.usage_context && (
                  <p className="text-sm text-muted-foreground italic text-center py-3">
                    还没有填写详细内容——凭感觉评分就好
                  </p>
                )}

              {currentTerm.definition && (
                <ContentSection label="定义">
                  <p className="text-base leading-relaxed">
                    {currentTerm.definition}
                  </p>
                </ContentSection>
              )}

              {currentTerm.examples && (
                <ContentSection label="例句">
                  <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/80">
                    {currentTerm.examples}
                  </p>
                </ContentSection>
              )}

              {currentTerm.usage_context && (
                <ContentSection label="使用场景">
                  <p className="text-sm leading-relaxed text-foreground/80">
                    {currentTerm.usage_context}
                  </p>
                </ContentSection>
              )}
            </div>

            {/* 提交失败提示 */}
            {submitError && (
              <div className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                提交失败，请检查网络后重试。
              </div>
            )}

            {/* 评分按钮 */}
            <div className="px-4 pt-1 pb-5">
              <div className="grid grid-cols-4 gap-2">
                {RATING_CONFIG.map(({ rating, zh, en, className }) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => handleRating(rating)}
                    disabled={submittingRating !== null}
                    className={cn(
                      'flex flex-col items-center justify-center py-3 rounded-xl border font-medium transition-colors select-none',
                      className,
                      submittingRating === rating &&
                        'opacity-70 scale-[0.97]',
                      submittingRating !== null &&
                        submittingRating !== rating &&
                        'opacity-35 pointer-events-none',
                    )}
                  >
                    <span className="text-[1rem] leading-none">{zh}</span>
                    <span className="text-[10px] mt-1 font-normal opacity-60">
                      {en}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- 辅助组件（只在此文件内用到）---------------------------------------

function ContentSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </p>
      {children}
    </div>
  )
}
