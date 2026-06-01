import { BookOpen, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useTodayReviews } from '@/hooks/useReviews'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { data, isLoading } = useTodayReviews()

  const dueCount = data?.due_reviews.length ?? 0
  const newCount = data?.new_terms.length ?? 0
  const totalCount = dueCount + newCount

  return (
    <div className="flex flex-1 flex-col gap-8 bg-[#f8fbfe] px-6 py-8 text-[#1a1a1a]">
      <div>
        <p className="text-sm text-[#7c91a3]">
          {new Date().toLocaleDateString('zh-CN', {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">我的</h1>
      </div>

      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm">
        <p className="text-sm font-medium text-[#7c91a3]">今日任务</p>
        <div className="mt-4 flex items-end gap-2">
          <span className="text-5xl font-bold tabular-nums leading-none">
            {isLoading ? '—' : totalCount}
          </span>
          <span className="pb-1 text-sm text-[#7c91a3]">个词条</span>
        </div>
        {!isLoading && (
          <p className="mt-3 text-sm text-[#7c91a3]">
            {dueCount} 个到期复习，{newCount} 个新词
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Button className="h-12 gap-2" onClick={() => navigate('/')}>
          <BookOpen className="size-4" />
          去复习
        </Button>
        <Button
          variant="outline"
          className="h-12 gap-2 bg-white"
          onClick={() => navigate('/terms/new')}
        >
          <Plus className="size-4" />
          添加词条
        </Button>
      </div>
    </div>
  )
}
