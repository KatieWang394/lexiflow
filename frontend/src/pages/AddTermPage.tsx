/**
 * AddTermPage — 新建词条页面
 * ===========================
 * 路由：/terms/new
 *
 * 流程：
 *   1. 渲染 TermForm（只有 term 必填）
 *   2. 用户提交 → useCreateTerm mutation → POST /terms
 *   3. 成功 → 跳转到 /terms（词条列表）
 *   4. 失败 → 显示错误提示（不跳转）
 */

import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import TermForm, { type TermFormData } from '@/components/TermForm'
import { useCreateTerm } from '@/hooks/useTerms'

export default function AddTermPage() {
  const navigate = useNavigate()
  const { mutateAsync, isPending, isError } = useCreateTerm()

  async function handleSubmit(data: TermFormData) {
    await mutateAsync(data)
    // 成功后跳转到词条列表
    navigate('/terms')
  }

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
        <h1 className="text-base font-semibold ml-1">添加词条</h1>
      </div>

      {/* ── 表单内容 ─────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-5 overflow-y-auto">
        {/* 网络错误提示 */}
        {isError && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            提交失败，请检查网络或稍后重试。
          </div>
        )}

        <TermForm
          onSubmit={handleSubmit}
          isPending={isPending}
          submitLabel="添加词条"
        />
      </div>
    </div>
  )
}
