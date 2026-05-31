import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTerms } from '@/hooks/useTerms'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import type { TermStatus } from '@/types/api'

const PAGE_SIZE = 10

// status badge 颜色映射
const STATUS_VARIANT: Record<TermStatus, 'default' | 'secondary' | 'outline'> = {
  new: 'outline',
  learning: 'secondary',
  mastered: 'default',
}

const STATUS_LABEL: Record<TermStatus, string> = {
  new: '新词',
  learning: '学习中',
  mastered: '已掌握',
}

function formatLocalDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function TermListPage() {
  const navigate = useNavigate()

  // 筛选状态
  const [statusFilter, setStatusFilter] = useState<TermStatus | ''>('')
  const [tagInput, setTagInput] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  // 分页状态（skip = page index * PAGE_SIZE）
  const [page, setPage] = useState(0)

  const params = {
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(tagFilter ? { tag: tagFilter } : {}),
  }

  const { data: terms, isLoading, isError } = useTerms(params)

  // 切换筛选时重置到第一页
  function handleStatusChange(value: string) {
    setStatusFilter(value as TermStatus | '')
    setPage(0)
  }

  function handleTagSearch() {
    setTagFilter(tagInput.trim())
    setPage(0)
  }

  function handleTagClear() {
    setTagInput('')
    setTagFilter('')
    setPage(0)
  }

  const isEmpty = !isLoading && !isError && terms?.length === 0
  const hasMore = (terms?.length ?? 0) === PAGE_SIZE

  return (
    <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">词条列表</h1>
        <Button size="sm" onClick={() => navigate('/terms/new')}>
          添加词条
        </Button>
      </div>

      {/* 筛选器 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Status 下拉 */}
        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">全部状态</option>
          <option value="new">新词</option>
          <option value="learning">学习中</option>
          <option value="mastered">已掌握</option>
        </select>

        {/* Tag 搜索框 */}
        <div className="flex gap-2 flex-1">
          <Input
            placeholder="按标签筛选…"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTagSearch()}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={handleTagSearch}>
            搜索
          </Button>
          {tagFilter && (
            <Button variant="ghost" size="sm" onClick={handleTagClear}>
              清除
            </Button>
          )}
        </div>
      </div>

      {/* 活跃标签筛选提示 */}
      {tagFilter && (
        <p className="text-xs text-muted-foreground">
          正在按标签筛选：<span className="font-medium">{tagFilter}</span>
        </p>
      )}

      {/* 列表内容 */}
      {isLoading && (
        <p className="text-sm text-muted-foreground text-center py-10">加载中…</p>
      )}

      {isError && (
        <p className="text-sm text-destructive text-center py-10">
          加载失败，请检查后端是否运行。
        </p>
      )}

      {isEmpty && (
        <p className="text-sm text-muted-foreground text-center py-10">
          {statusFilter || tagFilter ? '没有符合条件的词条。' : '还没有词条，点击右上角添加第一个吧！'}
        </p>
      )}

      {!isLoading && !isError && terms && terms.length > 0 && (
        <div className="flex flex-col gap-3">
          {terms.map((term) => (
            <Card
              key={term.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/terms/${term.id}`)}
            >
              <CardContent className="p-4 flex flex-col gap-2">
                {/* 第一行：词条 + 语言 + status badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-semibold text-base truncate">{term.term}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{term.language}</span>
                  </div>
                  <Badge variant={STATUS_VARIANT[term.status]} className="shrink-0">
                    {STATUS_LABEL[term.status]}
                  </Badge>
                </div>

                {/* 定义（有则显示） */}
                {term.definition && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{term.definition}</p>
                )}

                {/* 第三行：标签 + 创建时间 */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex flex-wrap gap-1">
                    {term.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatLocalDate(term.created_at)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 分页控件 */}
      {!isLoading && !isError && (page > 0 || hasMore) && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">第 {page + 1} 页</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  )
}
