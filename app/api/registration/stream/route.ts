import { NextRequest } from 'next/server'
import { subscribeRegistrationUpdates } from '@/lib/registration-events'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return new Response('Missing sessionId', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: { sessionId: string; type: string; timestamp: string }) => {
        if (event.sessionId !== sessionId) return
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      const unsubscribe = subscribeRegistrationUpdates(send)

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`))
      }, 30000)

      const abort = () => {
        clearInterval(keepAlive)
        unsubscribe()
        controller.close()
      }

      request.signal.addEventListener('abort', abort)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  })
}
