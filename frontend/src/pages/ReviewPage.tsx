import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookMarked,
  CheckCircle2,
  Hand,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTodayReviews, useSubmitReview } from '@/hooks/useReviews'
import type { ReviewRating, Term } from '@/types/api'

type Phase = 'init' | 'reviewing' | 'divider' | 'done' | 'empty'

const RATING_CONFIG = [
  {
    rating: 'good' as const,
    label: '认识',
    hint: '记得',
    className: 'bg-[#cfe9df] text-[#174f44] hover:bg-[#bfe0d3]',
  },
  {
    rating: 'hard' as const,
    label: '模糊',
    hint: '有印象',
    className: 'bg-[#fde5bd] text-[#684214] hover:bg-[#f8d79d]',
  },
  {
    rating: 'forgot' as const,
    label: '忘记',
    hint: '没想起',
    className: 'bg-[#f7caca] text-[#71302d] hover:bg-[#efb5b5]',
  },
] as const

export default function ReviewPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useTodayReviews()
  const { mutateAsync } = useSubmitReview()

  const initialized = useRef(false)
  const [queue, setQueue] = useState<Term[]>([])
  const [dueCount, setDueCount] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false)
  const [phase, setPhase] = useState<Phase>('init')
  const [submittingRating, setSubmittingRating] = useState<ReviewRating | null>(null)
  const [submitError, setSubmitError] = useState(false)

  useEffect(() => {
    if (!data || initialized.current) return
    initialized.current = true

    const combined = [...data.due_reviews, ...data.new_terms]
    setQueue(combined)
    setDueCount(data.due_reviews.length)
    setPhase(combined.length === 0 ? 'empty' : 'reviewing')
  }, [data])

  async function handleRating(rating: ReviewRating) {
    const currentTerm = queue[currentIndex]
    if (!currentTerm) return

    setSubmitError(false)
    setSubmittingRating(rating)

    try {
      await mutateAsync({ termId: currentTerm.id, rating })

      const nextIndex = currentIndex + 1
      if (nextIndex >= queue.length) {
        setPhase('done')
      } else if (
        currentIndex === dueCount - 1 &&
        dueCount > 0 &&
        queue.length > dueCount
      ) {
        setPhase('divider')
      } else {
        setCurrentIndex(nextIndex)
        setIsRevealed(false)
      }
    } catch {
      setSubmitError(true)
    } finally {
      setSubmittingRating(null)
    }
  }

  function handleContinueFromDivider() {
    setPhase('reviewing')
    setCurrentIndex(dueCount)
    setIsRevealed(false)
  }

  if (isLoading || phase === 'init') {
    return (
      <ReviewShell className="items-center justify-center gap-3 text-[#7c91a3]">
        <Loader2 className="size-6 animate-spin" />
        <p className="text-sm">加载今日任务…</p>
      </ReviewShell>
    )
  }

  if (isError) {
    return (
      <ReviewShell className="items-center justify-center gap-4 px-8 text-center">
        <p className="text-sm text-[#7c91a3]">
          加载失败，请检查后端是否在运行。
        </p>
        <Button
          variant="outline"
          onClick={() => {
            initialized.current = false
            refetch()
          }}
          className="gap-1.5 bg-white"
        >
          <RefreshCw className="size-4" />
          重试
        </Button>
      </ReviewShell>
    )
  }

  if (phase === 'empty') {
    return (
      <ReviewShell className="justify-between px-6 py-8 text-center">
        <p className="text-left text-xs text-[#7c91a3]">
          {new Date().toLocaleDateString('zh-CN', {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </p>

        <div className="flex flex-col items-center gap-5">
          <div className="flex size-18 items-center justify-center rounded-full bg-white shadow-sm">
            <CheckCircle2 className="size-9 text-[#2d8fcb]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a1a]">今日已全部完成</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#7c91a3]">
              没有待复习的词条，也没有新词。
              <br />
              可以添加新词，或者去词条页整理内容。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button className="h-12 gap-2" onClick={() => navigate('/terms/new')}>
            <Plus className="size-4" />
            添加词条
          </Button>
          <Button
            variant="outline"
            className="h-12 gap-2 bg-white"
            onClick={() => navigate('/terms')}
          >
            <BookMarked className="size-4" />
            浏览词条
          </Button>
        </div>
      </ReviewShell>
    )
  }

  if (phase === 'divider') {
    const newCount = queue.length - dueCount
    return (
      <ReviewShell className="items-center justify-center gap-6 px-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-white shadow-sm">
          <CheckCircle2 className="size-8 text-[#2d8fcb]" />
        </div>
        <div>
          <h2 className="mb-1 text-lg font-semibold text-[#1a1a1a]">
            复习完成 {dueCount} 张
          </h2>
          <p className="text-sm text-[#7c91a3]">接下来是今日新词</p>
        </div>
        <div className="flex w-full max-w-xs items-center gap-3">
          <div className="h-px flex-1 bg-[#d6e4ef]" />
          <span className="flex items-center gap-1 whitespace-nowrap text-xs text-[#7c91a3]">
            <Sparkles className="size-3" />
            今日新词 · {newCount} 个
          </span>
          <div className="h-px flex-1 bg-[#d6e4ef]" />
        </div>
        <Button onClick={handleContinueFromDivider} className="w-full max-w-xs">
          开始学习新词
        </Button>
      </ReviewShell>
    )
  }

  if (phase === 'done') {
    const reviewedDue = dueCount
    const reviewedNew = queue.length - dueCount
    return (
      <ReviewShell className="items-center justify-center gap-6 px-8 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-white shadow-sm">
          <CheckCircle2 className="size-10 text-[#2d8fcb]" />
        </div>
        <div>
          <h2 className="mb-2 text-xl font-bold text-[#1a1a1a]">今日完成</h2>
          <p className="text-sm text-[#7c91a3]">
            {reviewedDue > 0 && `复习 ${reviewedDue} 张`}
            {reviewedDue > 0 && reviewedNew > 0 && ' · '}
            {reviewedNew > 0 && `新词 ${reviewedNew} 个`}
          </p>
        </div>
        <Button onClick={() => navigate('/terms')} className="w-full max-w-xs">
          查看词条列表
        </Button>
      </ReviewShell>
    )
  }

  const currentTerm = queue[currentIndex]
  if (!currentTerm) return null

  const isNewTerm = currentIndex >= dueCount
  const progressPct = queue.length > 0
    ? Math.round((currentIndex / queue.length) * 100)
    : 0

  return (
    <ReviewShell>
      <header className="shrink-0 px-7 pb-5 pt-10">
        <div className="mb-7 flex items-center justify-between text-xs font-medium text-[#7c91a3]">
          <span className="flex items-center gap-1">
            {isNewTerm && <Sparkles className="size-3" />}
            {isNewTerm ? '新词' : '复习'}
          </span>
          <span className="tabular-nums">
            {currentIndex + 1} / {queue.length}
          </span>
        </div>

        <h1 className="break-words text-5xl font-bold leading-none tracking-normal text-[#1a1a1a]">
          {currentTerm.term}
        </h1>
        <p className="mt-5 inline-flex max-w-full items-center rounded-full bg-[#d8e9f8] px-4 py-1.5 text-sm font-medium text-[#6e8ca5] shadow-sm">
          <span className="truncate">{formatTermMeta(currentTerm)}</span>
        </p>
      </header>

      {!isRevealed ? (
        <button
          type="button"
          onClick={() => setIsRevealed(true)}
          className="flex flex-1 flex-col items-center justify-center gap-5 px-8 pb-8 text-center text-[#9ab0c1] transition-colors hover:text-[#7d9aad]"
        >
          <span className="flex size-16 items-center justify-center rounded-full border border-[#c6deed] bg-white/30">
            <Hand className="size-7" />
          </span>
          <span className="text-base font-medium">
            请回忆词义，点击屏幕显示答案
          </span>
          <ProgressBar value={progressPct} className="mt-auto w-full" />
        </button>
      ) : (
        <>
          <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-36">
            {!currentTerm.definition &&
              !currentTerm.examples &&
              !currentTerm.usage_context && (
                <DetailCard title="提示">
                  <p className="text-sm leading-relaxed text-[#5d6872]">
                    还没有填写详细内容，凭记忆状态评分即可。
                  </p>
                </DetailCard>
              )}

            {currentTerm.definition && (
              <DetailCard title="释义">
                <p className="whitespace-pre-line text-base leading-8 text-[#3d454c]">
                  {currentTerm.definition}
                </p>
              </DetailCard>
            )}

            {currentTerm.examples && (
              <DetailCard title="例句">
                <p className="whitespace-pre-line text-base leading-8 text-[#3d454c]">
                  {currentTerm.examples}
                </p>
              </DetailCard>
            )}

            {currentTerm.usage_context && (
              <DetailCard title="使用场景">
                <p className="whitespace-pre-line text-base leading-8 text-[#3d454c]">
                  {currentTerm.usage_context}
                </p>
              </DetailCard>
            )}
          </section>

          {submitError && (
            <p className="mx-6 mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              提交失败，请检查网络后重试。
            </p>
          )}

          <footer className="fixed bottom-[60px] left-1/2 z-10 w-full max-w-md -translate-x-1/2 bg-[#f8fbfe]/95 px-4 pb-4 pt-3 backdrop-blur-sm">
            <div className="grid grid-cols-3 gap-3">
              {RATING_CONFIG.map(({ rating, label, hint, className }) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => handleRating(rating)}
                  disabled={submittingRating !== null}
                  className={cn(
                    'flex h-20 flex-col items-center justify-center rounded-xl font-semibold shadow-sm transition select-none',
                    className,
                    submittingRating === rating && 'scale-[0.98] opacity-70',
                    submittingRating !== null &&
                      submittingRating !== rating &&
                      'pointer-events-none opacity-40',
                  )}
                >
                  <span className="text-lg leading-none">{label}</span>
                  <span className="mt-2 text-xs font-medium opacity-75">
                    {hint}
                  </span>
                </button>
              ))}
            </div>
            <ProgressBar value={progressPct} className="mt-3" />
          </footer>
        </>
      )}
    </ReviewShell>
  )
}

function ReviewShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-[calc(100svh-60px)] min-h-[calc(100svh-60px)] flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#c4ddf2_0%,#deeaf6_26%,#eef4fb_58%,#f8fbfe_100%)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

function DetailCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <article className="rounded-2xl bg-white/95 px-6 py-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-bold text-[#1a1a1a]">
        <span className="h-6 w-1 rounded-full bg-[#3b9ad6]" />
        {title}
      </h2>
      {children}
    </article>
  )
}

function ProgressBar({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <div className={cn('h-1 overflow-hidden rounded-full bg-[#dde8f2]', className)}>
      <div
        className="h-full rounded-full bg-[#2d8fcb] transition-all duration-500 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function formatTermMeta(term: Term) {
  const parts = [term.language, ...term.tags].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '词条'
}
