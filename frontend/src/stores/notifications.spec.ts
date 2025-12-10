import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNotificationStore } from './notifications'

describe('notifications store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds a notification with defaults', () => {
    const store = useNotificationStore()
    store.addNotification({ type: 'info', message: 'Hello' })
    expect(store.notifications.length).toBe(1)
    const n = store.notifications[0]
    expect(n.dismissible).toBeDefined()
    expect(n.timeout).toBeDefined()
    expect(n.id).toBeDefined()
  })

  it('dismisses notification by id', () => {
    const store = useNotificationStore()
    store.addNotification({ type: 'info', message: 'One' })
    const id = store.notifications[0].id
    store.dismissNotification(id)
    expect(store.notifications.length).toBe(0)
  })

  it('clearAll empties notifications', () => {
    const store = useNotificationStore()
    store.addNotification({ type: 'info', message: 'A' })
    store.addNotification({ type: 'info', message: 'B' })
    store.clearAll()
    expect(store.notifications.length).toBe(0)
  })
})
