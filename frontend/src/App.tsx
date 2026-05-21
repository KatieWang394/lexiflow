import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function App() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            LexiFlow
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground text-center">
            你的个人词汇复习工具，前端正在建设中...
          </p>
          <div className="flex gap-2">
            <Badge variant="secondary">React</Badge>
            <Badge variant="secondary">TypeScript</Badge>
            <Badge variant="secondary">Tailwind v4</Badge>
            <Badge variant="secondary">shadcn/ui</Badge>
          </div>
          <Button className="w-full">开始复习</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default App
