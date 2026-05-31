import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react'
import { useTerm, useDeleteTerm } from '@/hooks/useTerms'
import { useTermReviews } from '@/hooks/useReviews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { TermStatus, ReviewRating } from '@/types/api'

// ---- 常量映射 --------------------------------------------------------

const STATUS_LABEL: Record<TermStatus, string> = {
  new: '新词',
  learning: '学习中',
  mastered: '已掌握',
}

const STATUS_VARIANT: Record<TermStatus, 'default' | 'secondary' | 'outline'> = {
  new: 'outline',
  learning: 'secondary',
  mastered: 'default',
}

const RATING_LABEL: Record<ReviewRating, string> = {
  forgot: '忘记了',
  hard: '较难',
  good: '掌握',
  easy: '容易',
}

const RATING_VARIANT: Record<ReviewRating, 'destructive' | 'secondary' | 'outline' | 'default'> = {
  forgot: 'destructive',
  hard: 'secondary',
  good: 'outline',
  easy: 'default',
}

// ---- 时间格式化 -------------------------------------------------------

function toLocal(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toLocalDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---- 字段行（label + value）------------------------------------------

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value || <span className="text-muted-foreground italic">—</span>}</span>
    </div>
  )
}

// ---- 主组件 ----------------------------------------------------------

export default function TermDetailPage() {
  const { id } = useParams<{ id: string }>()
  const termId = Number(id)
  const navigate = useNavigate()

  const { data: term, isLoading, isError } = useTerm(termId)
  const { data: reviews } = useTermReviews(termId)
  const { mutateAsync: deleteTerm, isPending: isDeleting } = useDeleteTerm()

  // 删除确认状态（内联，不用 window.confirm）
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDelete() {
    await deleteTerm(termId)
    navigate('/terms', { replace: true })
  }

  // ---- 加载 / 错误状态 -----------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1 p-6">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </div>
    )
  }

  if (isError || !term) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-6 gap-3">
        <p className="text-sm text-destructive">找不到该词条，可能已被删除。</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/terms')}>
          返回列表
        </Button>
      </div>
    )
  }

  // ---- 正常渲染 -------------------------------------------------------

  return (
    <div className="flex flex-col flex-1">
      {/* ── 页内 header ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="返回"
        >
          <ChevronLeft className="size-4" />
          返回
        </button>
        <h1 className="text-base font-semibold ml-1 truncate flex-1">{term.term}</h1>
        {/* 编辑 + 删除操作区 */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/terms/${termId}/edit`)}
            aria-label="编辑"
          >
            <Pencil className="size-4 mr-1" />
            编辑
          </Button>
          {!confirmDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              aria-label="删除"
            >
              <Trash2 className="size-4 mr-1" />
              删除
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-destructive">确认删除？</span>
              <Button
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                onClick={handleDelete}
              >
                {isDeleting ? '删除中…' : '确认'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                取消
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── 内容区 ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6 max-w-2xl mx-auto w-full">

        {/* ── 词条信息卡 ─────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          {/* 大标题 + 语言 + status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold break-words">{term.term}</h2>
              <span className="text-sm text-muted-foreground">{term.language}</span>
            </div>
            <Badge variant={STATUS_VARIANT[term.status]} className="shrink-0 mt-1">
              {STATUS_LABEL[term.status]}
            </Badge>
          </div>

          {/* tags */}
          {term.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {term.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <Separator />

          {/* 定义 */}
          <InfoRow label="定义" value={term.definition} />

          {/* 例句 */}
          {term.examples && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">例句</span>
              <p className="text-sm whitespace-pre-wrap">{term.examples}</p>
            </div>
          )}

          {/* 使用场景 */}
          {term.usage_context && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">使用场景</span>
              <p className="text-sm whitespace-pre-wrap">{term.usage_context}</p>
            </div>
          )}

          <Separator />

          {/* 时间戳网格 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <InfoRow label="创建时间" value={toLocalDate(term.created_at)} />
            <InfoRow
              label="上次复习"
              value={term.last_reviewed_at ? toLocal(term.last_reviewed_at) : '尚未复习'}
            />
            <InfoRow
              label="下次复习"
              value={term.next_review_at ? toLocal(term.next_review_at) : '—'}
            />
          </div>

          {/* SRS 数据 */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-muted/50 p-3 flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">间隔天数</span>
              <span className="text-lg font-semibold">{term.interval_days}</span>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">复习次数</span>
              <span className="text-lg font-semibold">{term.repetitions}</span>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">难易系数</span>
              <span className="text-lg font-semibold">{term.ease_factor.toFixed(1)}</span>
            </div>
          </div>
        </section>

        {/* ── 复习历史时间线 ──────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            复习历史
          </h3>

          {!reviews || reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无复习记录。</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {/* 后端已按 reviewed_at 升序返回，倒序显示 */}
              {[...reviews].reverse().map((log) => (
                <li key={log.id} className="flex items-start gap-3">
                  {/* 时间线圆点 */}
                  <div className="flex flex-col items-center pt-1">
                    <div className="size-2 rounded-full bg-border shrink-0" />
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={RATING_VARIANT[log.rating]} className="text-xs">
                        {RATING_LABEL[log.rating]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {toLocal(log.reviewed_at)}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      下次间隔 {log.interval_days_after} 天
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
