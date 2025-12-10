import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import NotificationContainer from './NotificationContainer.vue'
import { useNotificationStore } from '@/stores/notifications'

describe('NotificationContainer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders active notification from store', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useNotificationStore()
    store.addNotification({ type: 'info', message: 'Hi' })

    const wrapper = mount(NotificationContainer, {
      global: { plugins: [pinia] }
    })

    expect(wrapper.text()).toContain('Hi')
  })

  it('auto-dismisses notification after timeout', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useNotificationStore()
    store.addNotification({ type: 'info', message: 'Auto', timeout: 100 })

    const wrapper = mount(NotificationContainer, {
      global: { plugins: [pinia] }
    })

    expect(wrapper.text()).toContain('Auto')
    vi.advanceTimersByTime(200)
    // allow watchers to run
    await wrapper.vm.$nextTick()
    expect(store.activeNotification).toBeNull()
  })

  it('dismisses on Escape key', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useNotificationStore()
    store.addNotification({ type: 'info', message: 'Esc' })

    const wrapper = mount(NotificationContainer, {
      global: { plugins: [pinia] }
    })

    expect(wrapper.text()).toContain('Esc')
    await wrapper.trigger('keydown', { key: 'Escape' })
    // keydown handler attached to window in component; manually dispatch
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(store.activeNotification).toBeNull()
  })
})
