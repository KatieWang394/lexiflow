/**
 * TermForm — 可复用的词条表单
 * ============================
 * 用于 AddTermPage（新建）和 EditTermPage（编辑，预填数据）。
 *
 * 设计原则（来自 FRONTEND_DECISIONS.md）：
 *   P01 — placeholder 不暗示 AI 生成，承认多种内容来源
 *   P02 — term 是唯一必填字段；其他字段明确标注"可选"，视觉轻量
 *   P03 — 支持任意语言、长文本、多词短语；textarea 用于 examples/usage_context
 *
 * 内部用逗号字符串管理 tags，submit 时拆分成 string[]。
 */

import { useForm } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ---- 类型定义 --------------------------------------------------------

/** 表单内部状态（tags 用逗号字符串，方便用户输入） */
type RawFormValues = {
  term: string
  language: string
  definition: string
  examples: string
  usage_context: string
  tags: string // 逗号分隔，如 "grammar, formal, business"
}

/** TermForm 向父组件 onSubmit 传递的已处理数据 */
export type TermFormData = {
  term: string
  language: string
  definition: string
  examples: string
  usage_context: string
  tags: string[] // 已拆分、去空白
}

interface TermFormProps {
  /**
   * EditTermPage 传入已有词条数据做预填。
   * tags 是 string[]，组件内部 join 成逗号字符串。
   * AddTermPage 不传此项（使用内置默认值）。
   */
  defaultValues?: {
    term?: string
    language?: string
    definition?: string
    examples?: string
    usage_context?: string
    tags?: string[]
  }
  /** 父组件处理 API 调用；接收已处理的 TermFormData */
  onSubmit: (data: TermFormData) => void | Promise<void>
  /** 提交按钮禁用状态（mutation isPending 时传 true） */
  isPending?: boolean
  /** 自定义提交按钮文案，默认"保存" */
  submitLabel?: string
}

// ---- 辅助组件 --------------------------------------------------------

/** 字段容器：统一垂直间距 */
function Field({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>
}

/** 可选字段标签：标签名 + "(可选)" 标注 */
function OptionalLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <Label htmlFor={htmlFor} className="flex items-baseline gap-1.5">
      <span>{children}</span>
      <span className="text-xs font-normal text-muted-foreground">可选</span>
    </Label>
  )
}

/** 字段错误提示 */
function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
}

// ---- 主组件 ---------------------------------------------------------

export default function TermForm({
  defaultValues,
  onSubmit,
  isPending = false,
  submitLabel = '保存',
}: TermFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RawFormValues>({
    defaultValues: {
      term: defaultValues?.term ?? '',
      language: defaultValues?.language ?? 'en',
      definition: defaultValues?.definition ?? '',
      examples: defaultValues?.examples ?? '',
      usage_context: defaultValues?.usage_context ?? '',
      // string[] → 逗号字符串，供用户编辑
      tags: defaultValues?.tags?.join(', ') ?? '',
    },
  })

  // 表单提交：把逗号字符串拆成 string[]，再交给父组件
  function processAndSubmit(raw: RawFormValues) {
    const tags = raw.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean) // 过滤空字符串

    onSubmit({ ...raw, tags })
  }

  return (
    <form
      onSubmit={handleSubmit(processAndSubmit)}
      className="flex flex-col gap-5"
      noValidate
    >
      {/* ── term（必填） ──────────────────────────────────────── */}
      <Field>
        <Label htmlFor="term" className="text-base font-semibold">
          词条 / Term or phrase
          {/* 唯一必填字段，不加"可选"标注，用粗体区分 */}
        </Label>
        <Input
          id="term"
          placeholder="e.g. paradigm shift, 以柔克刚, déjà vu"
          autoComplete="off"
          autoFocus
          aria-invalid={!!errors.term}
          {...register('term', {
            required: '请填写词条',
            // 前后空格自动剪裁
            setValueAs: (v: string) => v.trim(),
            validate: (v) => v.length > 0 || '请填写词条',
          })}
          className="text-base"
        />
        <FieldError message={errors.term?.message} />
      </Field>

      {/* ── language（可选，默认 "en"） ──────────────────────── */}
      <Field>
        <OptionalLabel htmlFor="language">语言</OptionalLabel>
        <Input
          id="language"
          placeholder="en"
          autoComplete="off"
          {...register('language')}
        />
        <p className="text-xs text-muted-foreground">
          任意文本，例如 en、zh、fr、ja
        </p>
      </Field>

      {/* ── definition（可选） ──────────────────────────────── */}
      <Field>
        <OptionalLabel htmlFor="definition">定义 / Definition</OptionalLabel>
        <Textarea
          id="definition"
          rows={3}
          placeholder="Paste from your notes, a dictionary, reading, or AI-generated output"
          {...register('definition')}
          className="min-h-[80px]"
        />
      </Field>

      {/* ── examples（可选） ────────────────────────────────── */}
      <Field>
        <OptionalLabel htmlFor="examples">例句 / Examples</OptionalLabel>
        <Textarea
          id="examples"
          rows={4}
          placeholder={
            'Paste from your notes, reading, or AI-generated output\n\n' +
            'Multiple examples separated by line breaks are fine.'
          }
          {...register('examples')}
          className="min-h-[100px]"
        />
      </Field>

      {/* ── usage_context（可选） ────────────────────────────── */}
      <Field>
        <OptionalLabel htmlFor="usage_context">使用场景 / Usage context</OptionalLabel>
        <Textarea
          id="usage_context"
          rows={3}
          placeholder="Where did you encounter this? Formal writing, casual speech, tech docs…"
          {...register('usage_context')}
          className="min-h-[80px]"
        />
      </Field>

      {/* ── tags（可选，逗号分隔） ──────────────────────────── */}
      <Field>
        <OptionalLabel htmlFor="tags">标签 / Tags</OptionalLabel>
        <Input
          id="tags"
          placeholder="grammar, formal, chapter-3"
          autoComplete="off"
          {...register('tags')}
        />
        <p className="text-xs text-muted-foreground">
          逗号分隔，例如：grammar, business, 第三章
        </p>
      </Field>

      {/* ── 提交按钮 ────────────────────────────────────────── */}
      <Button
        type="submit"
        disabled={isPending}
        className={cn('w-full mt-1', isPending && 'opacity-70')}
      >
        {isPending ? '保存中…' : submitLabel}
      </Button>
    </form>
  )
}
