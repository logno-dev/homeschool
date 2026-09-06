import { EventEmitter } from 'events'
import { db } from '@/lib/db'
import { sessions } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export interface RegistrationEvent {
  sessionId: string
  type: 'update'
  timestamp: string
}

const globalEmitter = globalThis as typeof globalThis & {
  registrationEventEmitter?: EventEmitter
}

const registrationEventEmitter = globalEmitter.registrationEventEmitter ?? new EventEmitter()
globalEmitter.registrationEventEmitter = registrationEventEmitter

export function publishRegistrationUpdate(sessionId: string) {
  const timestamp = new Date().toISOString()
  const event: RegistrationEvent = {
    sessionId,
    type: 'update',
    timestamp
  }
  registrationEventEmitter.emit('update', event)
  void db.update(sessions).set({ updatedAt: timestamp }).where(eq(sessions.id, sessionId)).catch((error) => {
    console.error('Unable to persist registration update timestamp:', error)
  })
}

export function subscribeRegistrationUpdates(handler: (event: RegistrationEvent) => void) {
  registrationEventEmitter.on('update', handler)
  return () => registrationEventEmitter.off('update', handler)
}
