import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, BookMarked, CheckCircle } from 'lucide-react'
import { useTodayReviews } from '@/hooks/useReviews'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const navigate = useNavigate()
  const { data, isLoading } = useTodayReviews()

  const dueCount = data?.due_reviews.length ?? 0
  const newCount = data?.new_terms.length ?? 0
  const totalCount = dueCount + newCount
  const allDone = !isLoading && totalCount === 0

  return (
    <div className="flex flex-col flex-1 justify-between px-6 py-8">

      {/* ── 今日日期 ─────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground">
        {new Date().toLocaleDateString('zh-CN', {
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        })}
      </p>

      {/* ── 主体区（数字 + 说明 + CTA）────────────────────────── */}
      <div className="flex flex-col items-center text-center gap-6 py-4">

        {allDone ? (
          /* 全部复习完 —— 鼓励状态 */
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="size-14 text-primary stroke-[1.5]" />
            <div className="flex flex-col gap-1">
              <p className="text-xl font-semibold">今日全部完成！</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                保持这个节奏，明天继续加油。
              </p>
            </div>
          </div>
        ) : isLoading ? (
          /* 加载中占位 */
          <div className="flex flex-col items-center gap-2">
            <div className="text-6xl font-bold tabular-nums text-muted-foreground/30 animate-pulse">
              —
            </div>
            <p className="text-sm text-muted-foreground">加载中…</p>
          </div>
        ) : (
          /* 有待复习内容 */
          <div className="flex flex-col items-center gap-4">
            {/* 核心数字 */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-7xl font-bold tabular-nums leading-none">
                {totalCount}
              </span>
              <span className="text-base text-muted-foreground">
                个词条待复习
              </span>
            </div>

            {/* 细分：到期 + 新词 */}
            {dueCount > 0 && newCount > 0 && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">{dueCount}</span>
                  {' '}到期复习
                </span>
                <span className="text-border">·</span>
                <span>
                  <span className="font-medium text-foreground">{newCount}</span>
                  {' '}新词
                </span>
              </div>
            )}

            {/* 只有新词时单独说明 */}
            {dueCount === 0 && newCount > 0 && (
              <p className="text-sm text-muted-foreground">
                均为今日新词，点击开始学习
              </p>
            )}
          </div>
        )}

        {/* ── 主按钮：开始复习 ─────────────────────────────────── */}
        {!allDone && (
          <Button
            size="lg"
            className="w-full gap-2 text-base h-12"
            disabled={isLoading}
            onClick={() => navigate('/review')}
          >
            <BookOpen className="size-5" />
            开始复习
          </Button>
        )}
      </div>

      {/* ── 次要入口 ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* 全部完成时也显示"开始复习"入口，但降级为 outline */}
        {allDone && (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => navigate('/review')}
          >
            <BookOpen className="size-4" />
            继续复习
          </Button>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => navigate('/terms/new')}
          >
            <Plus className="size-4" />
            添加词条
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => navigate('/terms')}
          >
            <BookMarked className="size-4" />
            浏览词条
          </Button>
        </div>
      </div>

    </div>
  )
}
