import { EventEmitter } from 'events'

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
  const event: RegistrationEvent = {
    sessionId,
    type: 'update',
    timestamp: new Date().toISOString()
  }
  registrationEventEmitter.emit('update', event)
}

export function subscribeRegistrationUpdates(handler: (event: RegistrationEvent) => void) {
  registrationEventEmitter.on('update', handler)
  return () => registrationEventEmitter.off('update', handler)
}
