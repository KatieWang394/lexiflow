import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useTerm, useUpdateTerm } from '@/hooks/useTerms'
import TermForm, { type TermFormData } from '@/components/TermForm'
import type { Term, TermUpdate } from '@/types/api'

// 只把表单里实际变动的字段放进 TermUpdate，避免不必要的写入。
// tags 特殊处理：只要内容变了（包括清空），就把新值（含 []）显式发送。
function buildUpdate(formData: TermFormData, initial: Term): TermUpdate {
  const update: TermUpdate = {}

  if (formData.term !== initial.term) update.term = formData.term
  if (formData.language !== initial.language) update.language = formData.language
  if (formData.definition !== initial.definition) update.definition = formData.definition
  if (formData.examples !== initial.examples) update.examples = formData.examples
  if (formData.usage_context !== initial.usage_context) update.usage_context = formData.usage_context

  // 比较排序后的 join，顺序无关紧要，内容变了才发
  const formTags = [...formData.tags].sort().join(',')
  const initTags = [...initial.tags].sort().join(',')
  if (formTags !== initTags) update.tags = formData.tags

  return update
}

export default function EditTermPage() {
  const { id } = useParams<{ id: string }>()
  const termId = Number(id)
  const navigate = useNavigate()

  const { data: term, isLoading, isError } = useTerm(termId)
  const { mutateAsync, isPending, isError: isMutateError } = useUpdateTerm()

  async function handleSubmit(formData: TermFormData) {
    if (!term) return
    const update = buildUpdate(formData, term)
    await mutateAsync({ id: termId, data: update })
    navigate(`/terms/${termId}`, { replace: true })
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
        <p className="text-sm text-destructive">找不到该词条。</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          返回
        </button>
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
        <h1 className="text-base font-semibold ml-1 truncate">编辑：{term.term}</h1>
      </div>

      {/* ── 表单内容 ─────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-5 overflow-y-auto max-w-2xl mx-auto w-full">
        {isMutateError && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            保存失败，请检查网络或稍后重试。
          </div>
        )}

        <TermForm
          defaultValues={{
            term: term.term,
            language: term.language,
            definition: term.definition,
            examples: term.examples,
            usage_context: term.usage_context,
            tags: term.tags,
          }}
          onSubmit={handleSubmit}
          isPending={isPending}
          submitLabel="保存修改"
        />
      </div>
    </div>
  )
}
