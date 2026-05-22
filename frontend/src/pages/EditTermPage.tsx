import { useParams } from 'react-router-dom'

export default function EditTermPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
      <h1 className="text-xl font-semibold mb-2">编辑词条</h1>
      <p className="text-muted-foreground text-sm">
        EditTermPage — id: {id}
      </p>
    </div>
  )
}
