import { useParams } from 'react-router-dom'

export default function TermDetailPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
      <h1 className="text-xl font-semibold mb-2">词条详情</h1>
      <p className="text-muted-foreground text-sm">
        TermDetailPage — id: {id}
      </p>
    </div>
  )
}
